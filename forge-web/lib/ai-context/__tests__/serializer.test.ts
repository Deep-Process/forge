import { describe, it, expect } from "vitest";
import { serializePageContext } from "../serializer";
import type { AIContextSnapshot, AIElementDescriptor, AIPageConfig } from "../types";

function makeSnapshot(
  elements: AIElementDescriptor[],
  pageConfig?: AIPageConfig | null,
): AIContextSnapshot {
  const map = new Map<string, AIElementDescriptor>();
  for (const el of elements) {
    map.set(el.id, el);
  }
  return { pageConfig: pageConfig ?? null, elements: map };
}

describe("serializePageContext", () => {
  it("serializes page header", () => {
    const result = serializePageContext(
      makeSnapshot([], { id: "tasks", title: "Tasks", description: "Task list" }),
    );
    expect(result).toContain("## Current Page: Tasks");
    expect(result).toContain("Task list");
  });

  it("serializes page without description", () => {
    const result = serializePageContext(
      makeSnapshot([], { id: "tasks", title: "Tasks" }),
    );
    expect(result).toContain("## Current Page: Tasks");
    expect(result).not.toContain("undefined");
  });

  it("serializes filter element with value", () => {
    const result = serializePageContext(
      makeSnapshot([
        { id: "status-filter", type: "filter", label: "Status", value: "TODO" },
      ]),
    );
    expect(result).toContain("### Page State");
    expect(result).toContain('Status: "TODO"');
  });

  it("serializes button element with endpoint-only action", () => {
    const result = serializePageContext(
      makeSnapshot([
        {
          id: "new-task",
          type: "button",
          label: "New Task",
          actions: [
            { label: "Create", endpoint: "/projects/{slug}/tasks", method: "POST" },
          ],
        },
      ]),
    );
    // Endpoint-only actions (no toolName) are not shown in Available Actions
    expect(result).toContain("### Page State");
    expect(result).toContain("New Task");
  });

  it("serializes list with data summary", () => {
    const result = serializePageContext(
      makeSnapshot([
        {
          id: "task-list",
          type: "list",
          label: "Tasks",
          description: "42 items",
          data: {
            count: 42,
            statuses: { TODO: 10, DONE: 20, IN_PROGRESS: 12 },
          },
        },
      ]),
    );
    expect(result).toContain("Tasks");
    expect(result).toContain("42 items");
    expect(result).toContain("count: 42");
    expect(result).toContain("TODO: 10");
  });

  it("serializes form element", () => {
    const result = serializePageContext(
      makeSnapshot([
        {
          id: "task-form",
          type: "form",
          label: "Task Form",
          value: false,
          description: "closed",
          actions: [
            { label: "Submit", endpoint: "/projects/{slug}/tasks", method: "POST" },
          ],
        },
      ]),
    );
    expect(result).toContain("Task Form");
    expect(result).toContain("closed");
  });

  it("serializes actions with tool names and availability", () => {
    const result = serializePageContext(
      makeSnapshot([
        {
          id: "task-actions",
          type: "action",
          label: "Task Actions",
          actions: [
            {
              label: "Start",
              toolName: "updateTask",
              toolParams: ["task_id*", "status=IN_PROGRESS"],
              available: true,
              availableWhen: "status = TODO",
            },
            {
              label: "Done",
              toolName: "updateTask",
              toolParams: ["task_id*", "status=DONE"],
              available: false,
            },
          ],
        },
      ]),
    );
    expect(result).toContain("### Available Actions");
    expect(result).toContain("**Start**");
    expect(result).toContain("`updateTask(");
    expect(result).toContain("when: status = TODO");
    expect(result).toContain("**Done**");
    expect(result).toContain("currently disabled");
  });

  it("truncates at maxChars", () => {
    const elements: AIElementDescriptor[] = [];
    for (let i = 0; i < 100; i++) {
      elements.push({
        id: `el-${i}`,
        type: "display",
        label: `Element ${i} with a very long description that takes up space`,
        description: "This is a detailed description that adds more characters",
      });
    }
    const result = serializePageContext(makeSnapshot(elements), {
      maxChars: 500,
    });
    expect(result.length).toBeLessThanOrEqual(500);
    expect(result).toContain("truncated");
  });

  it("serializes empty snapshot", () => {
    const result = serializePageContext(makeSnapshot([]));
    expect(result).toBe("");
  });

  it("serializes data arrays with maxItems limit", () => {
    const result = serializePageContext(
      makeSnapshot([
        {
          id: "items",
          type: "list",
          label: "Items",
          data: {
            ids: ["A", "B", "C", "D", "E", "F"],
          },
        },
      ]),
      { maxItems: 3 },
    );
    expect(result).toContain("A, B, C");
    expect(result).toContain("+3 more");
  });

  it("omits zero values in data objects", () => {
    const result = serializePageContext(
      makeSnapshot([
        {
          id: "stats",
          type: "display",
          label: "Stats",
          data: {
            statuses: { TODO: 5, DONE: 0, FAILED: 0 },
          },
        },
      ]),
    );
    expect(result).toContain("TODO: 5");
    expect(result).not.toContain("DONE: 0");
    expect(result).not.toContain("FAILED: 0");
  });

  it("handles element with no value, actions, or data", () => {
    const result = serializePageContext(
      makeSnapshot([
        { id: "simple", type: "display", label: "Just Text" },
      ]),
    );
    expect(result).toContain("- Just Text");
    expect(result).not.toContain("### Available Actions");
  });

  it("uses id as fallback when label is missing", () => {
    const result = serializePageContext(
      makeSnapshot([{ id: "my-element", type: "section" }]),
    );
    expect(result).toContain("my-element");
  });

  it("generates browsing hints for known entity types", () => {
    const result = serializePageContext(
      makeSnapshot(
        [
          {
            id: "task-list",
            type: "list",
            label: "Tasks",
            actions: [
              { label: "Create", toolName: "createTask", toolParams: ["name*"] },
            ],
          },
        ],
        { id: "tasks", title: "Tasks", description: "Task list" },
      ),
    );
    expect(result).toContain("### Browsing");
    expect(result).toContain('searchEntities(query, entity_type="task")');
    expect(result).toContain('getEntity(entity_type="task"');
  });

  it("filters actions by activeScopes", () => {
    const result = serializePageContext(
      makeSnapshot([
        {
          id: "task-list",
          type: "list",
          label: "Tasks",
          actions: [
            { label: "Create task", toolName: "createTask", toolParams: ["name*"] },
            { label: "Create decision", toolName: "createDecision", toolParams: ["title*"] },
          ],
        },
      ]),
      { activeScopes: ["tasks"] },
    );
    expect(result).toContain("**Create task**");
    expect(result).not.toContain("**Create decision**");
    expect(result).toContain("action(s) hidden");
  });

  it("shows all actions when activeScopes is not provided", () => {
    const result = serializePageContext(
      makeSnapshot([
        {
          id: "mixed",
          type: "list",
          label: "Mixed",
          actions: [
            { label: "Create task", toolName: "createTask", toolParams: ["name*"] },
            { label: "Create decision", toolName: "createDecision", toolParams: ["title*"] },
          ],
        },
      ]),
    );
    expect(result).toContain("**Create task**");
    expect(result).toContain("**Create decision**");
    expect(result).not.toContain("hidden");
  });

  it("deduplicates actions by toolName+label", () => {
    const result = serializePageContext(
      makeSnapshot([
        {
          id: "el-1",
          type: "list",
          label: "List 1",
          actions: [
            { label: "Create", toolName: "createTask", toolParams: ["name*"] },
          ],
        },
        {
          id: "el-2",
          type: "list",
          label: "List 2",
          actions: [
            { label: "Create", toolName: "createTask", toolParams: ["name*"] },
          ],
        },
      ]),
    );
    // Should appear only once
    const matches = result.match(/\*\*Create\*\*/g);
    expect(matches).toHaveLength(1);
  });

  it("formats required params in call signature", () => {
    const result = serializePageContext(
      makeSnapshot([
        {
          id: "el",
          type: "action",
          label: "Actions",
          actions: [
            { label: "Create", toolName: "createTask", toolParams: ["name*", "description", "type*"] },
          ],
        },
      ]),
    );
    expect(result).toContain("`createTask(name, description, type)`");
    expect(result).toContain("name, type required");
  });

  it("formats params with default values", () => {
    const result = serializePageContext(
      makeSnapshot([
        {
          id: "el",
          type: "action",
          label: "Actions",
          actions: [
            { label: "Start", toolName: "updateTask", toolParams: ["task_id*", "status=IN_PROGRESS"] },
          ],
        },
      ]),
    );
    expect(result).toContain('`updateTask(task_id, status="IN_PROGRESS")`');
  });

  it("full integration: tasks page snapshot", () => {
    const result = serializePageContext(
      makeSnapshot(
        [
          { id: "status-filter", type: "filter", label: "Status", value: "TODO" },
          {
            id: "task-list",
            type: "list",
            label: "Tasks",
            description: "Project task list",
            data: {
              count: 42,
              filtered: 10,
              statuses: { TODO: 10, IN_PROGRESS: 8, DONE: 20, FAILED: 4 },
            },
            actions: [
              { label: "Start", toolName: "updateTask", toolParams: ["task_id*", "status=IN_PROGRESS"], availableWhen: "status = TODO" },
              { label: "Done", toolName: "updateTask", toolParams: ["task_id*", "status=DONE"], availableWhen: "status = IN_PROGRESS" },
              { label: "Create", toolName: "createTask", toolParams: ["name*", "description", "type*", "scopes"] },
            ],
          },
          {
            id: "task-form",
            type: "form",
            label: "Task Form",
            value: false,
            description: "closed",
            data: { fields: ["name*", "description", "type*", "scopes"] },
            actions: [
              { label: "Submit", endpoint: "/projects/{slug}/tasks", method: "POST" },
            ],
          },
        ],
        { id: "tasks", title: "Tasks", description: "Task management for project" },
      ),
    );

    expect(result).toContain("## Current Page: Tasks");
    expect(result).toContain("Task management for project");
    expect(result).toContain("### Page State");
    expect(result).toContain('Status: "TODO"');
    expect(result).toContain("count: 42");
    expect(result).toContain("TODO: 10");
    expect(result).toContain("### Available Actions");
    expect(result).toContain("**Start**");
    expect(result).toContain("**Create**");
    expect(result).toContain("`createTask(");
    expect(result).toContain("### Browsing");
    expect(result).toContain("searchEntities");
  });
});
