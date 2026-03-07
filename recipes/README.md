# Recipes — Task Graph Templates

Recipes are reusable task graph templates for common operations.
When `/plan` recognizes a standard pattern, it can use a recipe as a
starting point instead of decomposing from scratch.

## Usage

During `/plan`, after complexity assessment, check if a recipe matches:

```bash
python -m core.recipes list
python -m core.recipes show {recipe-name}
python -m core.recipes apply {project} {recipe-name} [--vars '{"key": "value"}']
```

## Creating Recipes

Each recipe is a JSON file in `recipes/` with this structure:

```json
{
  "name": "recipe-name",
  "description": "When to use this recipe",
  "variables": ["component_name", "test_framework"],
  "tasks": [
    {
      "id": "T-001",
      "name": "setup-{component_name}",
      "description": "...",
      "instruction": "...",
      "depends_on": []
    }
  ]
}
```

Variables in `{curly_braces}` are replaced when applying the recipe.
