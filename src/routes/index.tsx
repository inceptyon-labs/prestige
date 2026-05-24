import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { loadGoogleFonts } from "../lib/google-fonts";
import { EditorProvider } from "../context/EditorContext";
import { SettingsProvider } from "../lib/settings/SettingsContext";
import { EditorLayout } from "../components/EditorLayout";

const RouteComponent = () => {
  useEffect(() => {
    loadGoogleFonts();
  }, []);

  return (
    <SettingsProvider>
      <EditorProvider>
        <EditorLayout />
      </EditorProvider>
    </SettingsProvider>
  );
};

export const Route = createFileRoute("/")({
  component: RouteComponent,
});
