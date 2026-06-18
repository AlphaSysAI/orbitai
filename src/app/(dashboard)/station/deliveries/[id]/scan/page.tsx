import { DeliveryScanLoader } from "@/features/regiaire/reception/components/DeliveryScanLoader";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function DeliveryScanPage({ params }: PageProps) {
  const { id } = await params;
  return <DeliveryScanLoader deliveryId={id} />;
}
