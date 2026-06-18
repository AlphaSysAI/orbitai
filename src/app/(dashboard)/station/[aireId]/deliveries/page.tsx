import { DeliveriesList } from "@/features/regiaire/reception/components/DeliveriesList";

export default function DeliveriesPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-6 sm:max-w-2xl sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold uppercase italic tracking-tighter text-white sm:text-3xl">
          Réceptions
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Livraisons fournisseurs — scan et réconciliation RégiAire.
        </p>
      </header>
      <DeliveriesList />
    </div>
  );
}
