import PhaseClient from '@/components/PhaseClient';

export default function KaliteElKitabiPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <PhaseClient 
      params={params} 
      phaseId="kalite_el_kitabi" 
      phaseTitle="Kalite El Kitabı" 
      showEylemPlanTablosu={false} 
    />
  );
}
