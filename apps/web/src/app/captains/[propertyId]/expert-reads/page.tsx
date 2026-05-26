import { CaptainOfficeClient } from "../../captain-office-client";
import { getCaptainPropertyStaticParams } from "../../captain-static-params";

export const generateStaticParams = getCaptainPropertyStaticParams;

export default function CaptainOfficeExpertReadsPage({ params }: { params: { propertyId: string } }) {
  return <CaptainOfficeClient initialPropertyId={decodeURIComponent(params.propertyId)} section="expert-reads" />;
}
