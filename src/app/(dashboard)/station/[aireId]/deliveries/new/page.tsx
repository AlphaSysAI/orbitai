import { NewReceptionWizard } from "@/features/regiaire/reception/components/NewReceptionWizard";

type PageProps = {
  searchParams: Promise<{ deliveryId?: string }>;
};

export default async function NewDeliveryPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return <NewReceptionWizard resumeDeliveryId={params.deliveryId} />;
}
