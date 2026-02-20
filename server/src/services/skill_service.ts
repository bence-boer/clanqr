import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const SKILLS_DIR = join(homedir(), ".copilot", "skills");
const CACHE_TTL_MS = 5 * 60 * 1000;

export interface SkillInfo {
  name: string;
  description: string;
  path: string;
  content: string;
  files: { name: string; content: string }[];
}

interface SkillCache {
  skills: SkillInfo[];
  cached_at: number;
}

class SkillService {
  private cache: SkillCache | null = null;

  async list_skills(): Promise<SkillInfo[]> {
    const cached = this.get_valid_cache();
    if (cached) return cached;
    return this.scan_skills();
  }

  async get_skill(name: string): Promise<SkillInfo | null> {
    const skills = await this.list_skills();
    return skills.find((skill) => skill.name === name) ?? null;
  }

  async refresh_cache(): Promise<SkillInfo[]> {
    this.cache = null;
    return this.scan_skills();
  }

  private get_valid_cache(): SkillInfo[] | null {
    if (!this.cache) return null;
    if (Date.now() - this.cache.cached_at > CACHE_TTL_MS) return null;
    return this.cache.skills;
  }

  private scan_skills(): SkillInfo[] {
    if (!existsSync(SKILLS_DIR)) {
      this.cache = { skills: [], cached_at: Date.now() };
      return [];
    }

    const skills: SkillInfo[] = [];

    try {
      const entries = readdirSync(SKILLS_DIR, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const skill_path = join(SKILLS_DIR, entry.name);
        const skill = this.read_skill(skill_path);
        if (skill) skills.push(skill);
      }
    } catch (error) {
      console.error("Failed to scan skills directory:", error);
    }

    this.cache = { skills, cached_at: Date.now() };
    return skills;
  }

  private read_skill(skill_path: string): SkillInfo | null {
    const candidate_files = ["SKILL.md", "skill.md"];
    const READABLE_EXTENSIONS = new Set([".md", ".txt", ".yaml", ".yml", ".json", ".ts", ".js"]);

    for (const filename of candidate_files) {
      const file_path = join(skill_path, filename);
      if (!existsSync(file_path)) continue;

      try {
        const content = readFileSync(file_path, "utf-8");
        const { name, description } = parse_skill_frontmatter(content);

        // Read additional files in the skill directory (recursively)
        const files: { name: string; content: string }[] = [];
        const scan_dir = (dir_path: string, prefix: string) => {
          try {
            const entries = readdirSync(dir_path, { withFileTypes: true });
            for (const entry of entries) {
              const rel_name = prefix ? `${prefix}/${entry.name}` : entry.name;
              if (entry.isDirectory()) {
                scan_dir(join(dir_path, entry.name), rel_name);
              } else if (entry.isFile()) {
                if (dir_path === skill_path && entry.name === filename) continue;
                const ext_idx = entry.name.lastIndexOf(".");
                const ext = ext_idx === -1 ? "" : entry.name.slice(ext_idx).toLowerCase();
                if (!READABLE_EXTENSIONS.has(ext)) continue;
                try {
                  const file_content = readFileSync(join(dir_path, entry.name), "utf-8");
                  files.push({ name: rel_name, content: file_content });
                } catch {
                  // Skip unreadable files
                }
              }
            }
          } catch {
            // Skip if directory listing fails
          }
        };
        scan_dir(skill_path, "");

        return {
          name: name ?? skill_path.split("/").pop() ?? "unknown",
          description: description ?? "",
          path: skill_path,
          content,
          files,
        };
      } catch {
        continue;
      }
    }

    return null;
  }
}

function parse_skill_frontmatter(content: string): {
  name?: string;
  description?: string;
} {
  const frontmatter_match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatter_match) return {};

  const result: Record<string, string> = {};
  for (const line of frontmatter_match[1].split("\n")) {
    const colon_index = line.indexOf(":");
    if (colon_index === -1) continue;
    const key = line.slice(0, colon_index).trim();
    const value = line.slice(colon_index + 1).trim();
    if (key && value) result[key] = value;
  }

  return { name: result["name"], description: result["description"] };
}

export const skill_service = new SkillService();
