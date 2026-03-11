"""
Provider registry — discover, configure, and retrieve LLM providers.

Configuration is loaded from providers.toml (project-level or user-level).

Example providers.toml:

    [anthropic]
    provider = "anthropic"
    api_key_env = "ANTHROPIC_API_KEY"
    model = "claude-sonnet-4-20250514"

    [openai]
    provider = "openai"
    api_key_env = "OPENAI_API_KEY"
    model = "gpt-4o"

    [local]
    provider = "ollama"
    model = "llama3.1"
    base_url = "http://localhost:11434"
    context_window = 8192
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from core.llm.provider import LLMProvider, ProviderError

# Try to import tomllib (Python 3.11+) or tomli as fallback
try:
    import tomllib
except ImportError:
    try:
        import tomli as tomllib  # type: ignore[no-redef]
    except ImportError:
        tomllib = None  # type: ignore[assignment]


def _load_toml(path: Path) -> dict[str, Any]:
    """Load a TOML file. Returns empty dict if missing or if tomllib unavailable."""
    if tomllib is None or not path.exists():
        return {}
    with open(path, "rb") as f:
        return tomllib.load(f)


def _resolve_api_key(config: dict[str, Any]) -> str:
    """Resolve API key from config: direct value or environment variable."""
    if "api_key" in config:
        return config["api_key"]
    env_var = config.get("api_key_env", "")
    if env_var:
        key = os.environ.get(env_var, "")
        if not key:
            raise ProviderError(
                f"Environment variable {env_var} not set. "
                f"Set it or provide api_key directly in providers.toml."
            )
        return key
    return ""


def _create_provider(name: str, config: dict[str, Any]) -> LLMProvider:
    """Create a provider instance from config dict."""
    provider_type = config.get("provider", name).lower()

    if provider_type == "anthropic":
        from core.llm.providers.anthropic import AnthropicProvider

        api_key = _resolve_api_key(config)
        if not api_key:
            raise ProviderError(
                "Anthropic provider requires api_key or api_key_env"
            )
        return AnthropicProvider(
            api_key=api_key,
            model=config.get("model", "claude-sonnet-4-20250514"),
            base_url=config.get("base_url"),
        )

    elif provider_type == "openai":
        from core.llm.providers.openai import OpenAIProvider

        api_key = _resolve_api_key(config)
        if not api_key:
            raise ProviderError(
                "OpenAI provider requires api_key or api_key_env"
            )
        return OpenAIProvider(
            api_key=api_key,
            model=config.get("model", "gpt-4o"),
            base_url=config.get("base_url"),
            organization=config.get("organization"),
        )

    elif provider_type == "ollama":
        from core.llm.providers.ollama import OllamaProvider

        return OllamaProvider(
            model=config.get("model", "llama3.1"),
            base_url=config.get("base_url", "http://localhost:11434"),
            context_window=config.get("context_window", 8192),
            max_output=config.get("max_output", 4096),
        )

    else:
        raise ProviderError(f"Unknown provider type: {provider_type}")


class ProviderRegistry:
    """Registry for LLM providers loaded from configuration.

    Providers are lazily instantiated on first access.

    Usage:
        registry = ProviderRegistry.from_toml(Path("providers.toml"))
        provider = registry.get("anthropic")
        caps = provider.capabilities()
    """

    def __init__(self, configs: dict[str, dict[str, Any]] | None = None) -> None:
        self._configs: dict[str, dict[str, Any]] = configs or {}
        self._instances: dict[str, LLMProvider] = {}

    @classmethod
    def from_toml(cls, path: Path) -> ProviderRegistry:
        """Load provider configs from a TOML file."""
        data = _load_toml(path)
        return cls(configs=data)

    @classmethod
    def from_project(cls, project_dir: Path) -> ProviderRegistry:
        """Load providers from project-level or user-level config.

        Searches: {project_dir}/providers.toml, ~/.forge/providers.toml
        """
        candidates = [
            project_dir / "providers.toml",
            Path.home() / ".forge" / "providers.toml",
        ]
        for path in candidates:
            if path.exists():
                return cls.from_toml(path)
        return cls()

    def register(self, name: str, provider: LLMProvider) -> None:
        """Register a provider instance directly (e.g., for testing)."""
        self._instances[name] = provider

    def register_config(self, name: str, config: dict[str, Any]) -> None:
        """Register a provider config (lazy instantiation)."""
        self._configs[name] = config
        # Clear cached instance if exists
        self._instances.pop(name, None)

    def get(self, name: str) -> LLMProvider:
        """Get a provider by name. Creates the instance on first access.

        Raises:
            ProviderError: If provider not found or creation fails.
        """
        if name in self._instances:
            return self._instances[name]

        if name not in self._configs:
            raise ProviderError(
                f"Provider '{name}' not registered. "
                f"Available: {', '.join(self.list_providers())}"
            )

        provider = _create_provider(name, self._configs[name])
        self._instances[name] = provider
        return provider

    def list_providers(self) -> list[str]:
        """List all registered provider names (both config and instances)."""
        return sorted(set(self._configs.keys()) | set(self._instances.keys()))

    def has(self, name: str) -> bool:
        """Check if a provider is registered."""
        return name in self._configs or name in self._instances


# ---------------------------------------------------------------------------
# Module-level convenience
# ---------------------------------------------------------------------------

_default_registry: ProviderRegistry | None = None


def get_provider(name: str, project_dir: Path | None = None) -> LLMProvider:
    """Get a provider from the default registry.

    Args:
        name: Provider name (e.g., "anthropic", "openai", "local").
        project_dir: Optional project directory to search for providers.toml.
            Falls back to ~/.forge/providers.toml if not provided.

    Raises:
        ProviderError: If provider not found.
    """
    global _default_registry
    if _default_registry is None:
        search_dir = project_dir or Path.home() / ".forge"
        _default_registry = ProviderRegistry.from_project(search_dir)
    return _default_registry.get(name)
