import { VerdictScreen } from "@/features/regiaire/verdict/components/VerdictScreen";

type PageProps = {
  params: Promise<{ aireId: string }>;
};

export default async function VerdictPage({ params }: PageProps) {
  const { aireId } = await params;
  return <VerdictScreen aireId={aireId} />;
}
