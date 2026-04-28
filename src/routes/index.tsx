import { createFileRoute } from "@tanstack/react-router";
import ZeldaGame3D from "@/components/ZeldaGame3D";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Glade 3D — A tiny third-person adventure" },
      {
        name: "description",
        content:
          "Explore a 3D minimalist overworld, swing your sword against six monster types, and defeat the Lake Guardian.",
      },
    ],
  }),
});

function Index() {
  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center justify-start py-8 px-4">
      <header className="mb-6 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.5em] text-muted-foreground">
          A tiny 3D adventure
        </p>
        <h1 className="mt-2 text-4xl md:text-5xl font-light tracking-wide">Glade</h1>
      </header>
      <ZeldaGame3D />
      <footer className="mt-8 font-mono text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
        Six monsters · One sword · Five tunics · Find the Guardian
      </footer>
    </main>
  );
}
