import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { create_supabase_client } from "../db";
import { resolve_task_traits } from "../routes/traits";
import { skill_service } from "./skill_service";

const PROMPTS_DIR = join(
    process.env.WORKSPACE_DIR ?? join(import.meta.dir, "../../.."),
    "agents/prompts"
);

const PROMPT_FILES: Record<string, string> = {
    manager: join(PROMPTS_DIR, "manager.md"),
    ralph: join(PROMPTS_DIR, "ralph.md"),
};

class PromptService {
    async sync_from_repo(): Promise<void> {
        const supabase = create_supabase_client();

        for (const [role, file_path] of Object.entries(PROMPT_FILES)) {
            if (!existsSync(file_path)) {
                console.warn(`Prompt file not found: ${file_path}`);
                continue;
            }

            const content = readFileSync(file_path, "utf-8");

            const { error } = await supabase.from("prompts").upsert(
                { role, content, updated_at: new Date().toISOString() },
                { onConflict: "role" }
            );

            if (error) {
                console.error(`Failed to sync prompt '${role}':`, error.message);
            } else {
                console.log(`✅ Synced prompt: ${role}`);
            }
        }
    }

    async get_prompt(role: string): Promise<string | null> {
        const supabase = create_supabase_client();
        const { data, error } = await supabase
            .from("prompts")
            .select("content")
            .eq("role", role)
            .single();

        if (error || !data) return null;
        return data.content;
    }

    async update_prompt(role: string, content: string): Promise<boolean> {
        const supabase = create_supabase_client();

        // Write back to repo file
        const file_path = PROMPT_FILES[role];
        if (file_path) {
            writeFileSync(file_path, content, "utf-8");
        }

        const { error } = await supabase
            .from("prompts")
            .update({ content, updated_at: new Date().toISOString() })
            .eq("role", role);

        return !error;
    }

    // Build the full composed prompt for a Ralph task execution
    async resolve_for_task(
        task_id: string,
        task_spec: { description: string; feature_title: string; project_name: string; work_dir: string }
    ): Promise<string> {
        const supabase = create_supabase_client();

        // 1. Base prompt from DB
        const base_prompt = await this.get_prompt("ralph");
        const base_section = base_prompt
            ? base_prompt
            : "You are Ralph, a coding agent. Execute the assigned task carefully and thoroughly.";

        // 2. Resolve traits for this task
        const traits = await resolve_task_traits(supabase, task_id, "ralph");

        // 3. Get linked skills content
        const { data: skill_links } = await supabase
            .from("skill_links")
            .select("skill_name")
            .eq("task_id", task_id);

        const skill_sections: string[] = [];
        for (const link of skill_links ?? []) {
            const skill = await skill_service.get_skill(link.skill_name);
            if (skill) {
                skill_sections.push(`--- ${skill.name} ---\n${skill.content}`);
            }
        }

        // 4. Compose full prompt
        const parts: string[] = [base_section];

        if (traits.length > 0) {
            const traits_text = traits
                .map((trait) => `### ${trait.name}\n${trait.content}`)
                .join("\n\n");
            parts.push(`---\nADDITIONAL INSTRUCTIONS:\n\n${traits_text}`);
        }

        if (skill_sections.length > 0) {
            parts.push(`---\nSKILLS CONTEXT:\nThe following skill knowledge is available. Apply these patterns.\n\n${skill_sections.join("\n\n")}`);
        }

        parts.push(
            `---\nPROJECT: ${task_spec.project_name}\nFEATURE: ${task_spec.feature_title}\nTASK: ${task_spec.description}\n\nRead task-spec.json in ${task_spec.work_dir} for full details.\n\nWhen complete, write progress.json to ${task_spec.work_dir} with:\n{"status": "complete", "summary": "Brief description of what was done"}\n\nIf you encounter an error:\n{"status": "error", "summary": "Description of the problem"}`
        );

        return parts.join("\n\n");
    }

    // Build the composed prompt for a manager agent
    async resolve_for_manager(
        feature_spec: { title: string; description: string; project: string; resources: any[] },
        work_dir: string
    ): Promise<string> {
        const base_prompt = await this.get_prompt("manager");
        const base_section = base_prompt
            ? base_prompt
            : "You are a Manager Agent. Research and plan — never write implementation code.";

        const resources_text =
            feature_spec.resources.length > 0
                ? `\nResearch these resources:\n${feature_spec.resources.map((resource: any) => `- ${resource.url}${resource.title ? ` (${resource.title})` : ""}`).join("\n")}`
                : "";

        const task_instructions = `---\nPROJECT: ${feature_spec.project}\nFEATURE: ${feature_spec.title}\nDESCRIPTION: ${feature_spec.description ?? "No description provided"}${resources_text}\n\nYOUR TASK:\n1. Read and understand the feature specification\n2. If resources are provided, fetch and read each URL\n3. Break down this feature into concrete, actionable implementation tasks\n\nOUTPUT:\nWrite a JSON file called "tasks.json" in ${work_dir}.\nFormat: [{"description": "task description"}, ...]\n\nRULES:\n- Do NOT write any implementation code\n- Do NOT create any source files\n- ONLY output the tasks.json file\n- Keep tasks focused and actionable\n- Order tasks logically (dependencies first)`;

        return [base_section, task_instructions].join("\n\n");
    }
}

export const prompt_service = new PromptService();
