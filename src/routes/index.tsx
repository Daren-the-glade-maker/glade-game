import { createFileRoute } from "@tanstack/react-router";
import ZeldaGame from "@/components/ZeldaGame";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Glade — A tiny top-down adventure" },
      {
        name: "description",
        content:
          "Explore a minimalist geometric overworld, swing your sword, and find peace at Mirror Lake.",
      },
    ],
  }),
});

function Index() {
  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center py-10 px-4">
      <header className="mb-8 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.5em] text-muted-foreground">
          A tiny adventure
        </p>
        <h1 className="mt-2 text-4xl md:text-5xl font-light tracking-wide">
          Glade
        </h1>
      </header>
      <ZeldaGame />
      <footer className="mt-10 font-mono text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
        Three rooms · One sword · Find the lake
      </footer>
    </main>
  );
}
