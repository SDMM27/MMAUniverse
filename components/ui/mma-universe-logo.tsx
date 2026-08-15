import { lusitana } from '@/components/ui/fonts';
import Image from 'next/image';

export default function MMAUniverseLogo() {
  return (
    <div className={`${lusitana.className} flex flex-row items-center gap-2 leading-none text-ink-primary`}>
      <Image
        alt="MMA Universe logo"
        width={200}
        height={152}
        className="h-9 w-9 rotate-[15deg]"
        src="/MMAUniverse.png"
      />
      <p className="text-lg">MMA Universe</p>
    </div>
  );
}
