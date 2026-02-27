# How to Create an Agent (call with @) and Add Skills

Two short guides. No coding experience needed.

---

## Part 1: Create an agent you can call with @

In Cursor, an **agent** you call with **@** is a **Rule**. Rules are instruction files that tell the AI how to behave. When you type **@** in chat and pick a rule, that rule’s instructions are used for the conversation.

### Steps

1. **Open your project in Cursor**  
   Make sure you’re in the right folder (e.g. `tmlsn-app2`).

2. **Go to the rules folder**  
   In the file tree on the left, open:
   - **`.cursor`** (folder)
   - then **`rules`** (folder)  
   Path: `.cursor/rules/`

3. **Create a new rule file**  
   - Right‑click the **`rules`** folder → **New File**  
   - Or use **File → New File**, then save it inside `.cursor/rules/`  
   - Name it in lowercase with hyphens, ending in **`.mdc`**  
   - Example: **`my-helper-agent.mdc`**

4. **Put this at the very top of the file** (the “frontmatter”):
   ```yaml
   ---
   description: Short description of what this agent does (e.g. "Helps with writing clear commit messages")
   alwaysApply: false
   ---
   ```
   - **description**: One short sentence. This is what you’ll see when you type @ and look for your rule.  
   - **alwaysApply**: Use **false** so the agent is only used when you @ mention it. Use **true** only if you want it in every chat.

5. **Add your instructions below the frontmatter**  
   After the closing `---`, write in plain language what you want this agent to do. For example:
   ```markdown
   # My Helper Agent

   - When I ask for commit messages, suggest one short line and one optional body.
   - Use a calm, clear tone.
   - If I ask for code, add brief comments.
   ```

6. **Save the file**  
   (e.g. Ctrl+S or Cmd+S)

7. **Use it in chat with @**  
   - Open the Cursor chat (Composer or Chat).  
   - Type **@**.  
   - In the list, choose **Rules** (or look for your rule by name).  
   - Select your rule (e.g. **my-helper-agent**).  
   - Then type your question or task.  
   The AI will follow that rule for that conversation.

**Summary:** Create a `.mdc` file in `.cursor/rules/` with a `description` and your instructions, then in chat type **@** and select that rule to “call” your agent.

---

## Part 2: Add skills to that agent (or to Cursor in general)

**Skills** are instruction files that teach the AI how to do specific tasks (e.g. “review code”, “write commit messages”). The AI uses a skill when your request matches the skill’s **description**. You don’t @ a skill by name; the AI picks it automatically when it fits.

You can add skills in two places:
- **Personal (all projects):** `~/.cursor/skills/`  
- **This project only:** `.cursor/skills/` in your project

### Steps to add a skill

1. **Choose where the skill should live**  
   - **Only this project:** use `.cursor/skills/` inside your project.  
   - **All your projects:** use the folder `~/.cursor/skills/` on your computer (you may need to create it).

2. **Create a folder for the skill**  
   - Inside **`.cursor/skills/`** (project) or **`~/.cursor/skills/`** (personal), create a **new folder**.  
   - Name it in lowercase with hyphens, e.g. **`commit-messages`** or **`code-review`**.

3. **Create the skill file**  
   - Inside that folder, create a file named exactly **`SKILL.md`** (all caps, with the dot).

4. **Put this at the very top of `SKILL.md`**:
   ```yaml
   ---
   name: short-name-for-skill
   description: What this skill does and when to use it. Use when the user asks for X or mentions Y.
   ---
   ```
   - **name**: Short identifier, lowercase letters, numbers, hyphens only (e.g. `commit-messages`).  
   - **description**: One or two sentences. This is what the AI uses to decide “should I use this skill?”. Include both **what** it does and **when** (e.g. “Use when the user asks for commit messages or reviews staged changes”).

5. **Add the actual instructions below the frontmatter**  
   In plain language or short bullet points, describe the steps or rules. For example:
   ```markdown
   # Commit message skill

   - Read the staged changes (or the diff the user provides).
   - Suggest one line (max 72 chars) and optionally a short body.
   - Start with a verb: fix, feat, docs, refactor, etc.
   ```

6. **Save `SKILL.md`.**

7. **How it’s used**  
   You don’t type @ to call a skill. When you ask for something (e.g. “write a commit message for my changes”), the AI will consider all available skills and use the one whose **description** matches. So the better your **description**, the more reliably the right skill is used.

**Linking skills to your @ agent (rule)**  
If you have a rule (Part 1) that’s meant to act like an agent, you can **mention in that rule** that the AI should follow certain patterns—and those patterns can match what you put in skills. For example, in your rule you can write: “When the user asks for commit messages, follow the commit message skill: one line, then optional body.” The AI will then use both the rule (because you @’d it) and the skill (because the request matches the skill’s description).

**Summary:** Create a folder in `.cursor/skills/` or `~/.cursor/skills/`, add `SKILL.md` with `name` and `description` and your instructions. The AI uses skills automatically when your request matches the description; you can also reference that behavior in a rule you call with @.

---

## Quick reference

| What you want              | Where it lives           | How you use it        |
|----------------------------|--------------------------|------------------------|
| Agent you call with @      | `.cursor/rules/*.mdc`    | Type @ → pick the rule |
| Skill (used when relevant) | `.cursor/skills/.../SKILL.md` or `~/.cursor/skills/.../SKILL.md` | Ask normally; AI picks it by description |
