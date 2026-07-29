import { OrderWorkspace } from "@/components/order/order-workspace";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderWorkspace id={id} />;
}
