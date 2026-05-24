/**
 * Hook for rendering a one-line "provider · model" label next to AI buttons.
 *
 * Exists so the user can see which model a click is about to invoke without
 * digging into settings. The provider is per-project (activeProject.ai.provider);
 * the model id comes from the global settings, defaulting to "default" when
 * the user hasn't pinned a specific model for that tier.
 */

import { useEditor } from "../../context/EditorContext";
import { resolveModelForTier } from "./factory";
import type { ModelTier } from "../settings/types";
import type { ProviderId } from "./provider";

export const useModelLabel = (tier: ModelTier): string => {
  const { activeProject } = useEditor();
  const providerId: ProviderId = activeProject.ai?.provider ?? "claude";
  const model = resolveModelForTier(providerId, tier);
  return `${providerId} · ${model ?? "default"}`;
};
