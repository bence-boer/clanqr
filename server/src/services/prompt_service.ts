import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { create_supabase_client } from "../db";

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
}

export const prompt_service = new PromptService();
