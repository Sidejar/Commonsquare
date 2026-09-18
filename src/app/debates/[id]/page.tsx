import type { Metadata } from "next";
import { CS } from "@/lib/cs";
import { DebatesNav } from "@/components/debates/debate-ui";
import { DebateView } from "@/components/debates/debate-view";
import { getDebateRoundsServer, getDebateServer } from "@/lib/debates-server";

// Server-render open debates for SEO + share previews (same approach as
// /topics/[slug]). The server reads as anon, so a closed debate or a direct
// challenge comes back null here — no notFound(): the viewer may be one of
// its two debaters, which only the client (where the session lives) can tell.
export const dynamic = "force-dynamic";

interface PageProps {
  params: { id: string };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const debate = await getDebateServer(params.id);
  if (!debate) {
    return { title: "Debate · CommonSquare", robots: { index: false } };
  }
  const versus = debate.b_handle
    ? `@${debate.a_handle} vs @${debate.b_handle}`
    : `@${debate.a_handle} is looking for an opponent`;
  const description = `${versus} — three rounds on CommonSquare: opening, rebuttal, closing. Read the debate.`;
  const url = `https://commonsquare.app/debates/${debate.id}`;
  return {
    title: `${debate.prompt} · Debate · CommonSquare`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: debate.prompt,
      description,
      type: "article",
      url,
      siteName: "CommonSquare",
      publishedTime: debate.created_at,
      modifiedTime: debate.updated_at,
    },
    twitter: { card: "summary", title: debate.prompt, description },
  };
}

export default async function DebatePage({ params }: PageProps) {
  const debate = await getDebateServer(params.id);
  const rounds = debate ? await getDebateRoundsServer(debate.id) : [];

  return (
    <main className="min-h-screen" style={{ background: CS.paper }}>
      <DebatesNav />
      <DebateView
        debateId={params.id}
        initialDebate={debate}
        initialRounds={rounds}
      />
    </main>
  );
}
