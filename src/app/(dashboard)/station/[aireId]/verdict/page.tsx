import Link from "next/link";
import { ArrowLeft, Brain } from "lucide-react";

type PageProps = {
  params: Promise<{ aireId: string }>;
};

export default async function VerdictPage({ params }: PageProps) {
  const { aireId } = await params;

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-12 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-600/20">
        <Brain className="text-amber-400" size={32} />
      </div>
      <h1 className="text-2xl font-extrabold uppercase italic tracking-tighter text-white">
        Verdict IA
      </h1>
      <p className="text-sm text-slate-400">
        La génération IA et l&apos;écran de recommandation seront disponibles à
        l&apos;étape 2. Les signaux et tendances sont déjà prêts côté serveur.
      </p>
      <Link
        href={`/station/${aireId}/dashboard`}
        className="inline-flex items-center gap-2 text-sm font-bold text-amber-400 hover:text-amber-300"
      >
        <ArrowLeft size={16} />
        Retour à l&apos;aire
      </Link>
    </div>
  );
}
