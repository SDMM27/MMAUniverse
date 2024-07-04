import { lusitana } from '@/components/ui/fonts';
import Image from 'next/image';

export default function AcmeLogo() {
  return (
    <div
      className={`${lusitana.className} flex flex-row items-center leading-none text-white`}
    >
      <Image
      alt="MMA Universe logo"
      width={1000}
      height={760}
      className="h-40 w-40 hidden md:block rotate-[15deg]" 
      src="/MMAUniverse.png"
      />
            <Image
      alt="MMA Universe logo"
      width={560}
      height={620}
      className="w-20 block md:hidden rotate-[15deg]" 
      src="/MMAUniverse.png"
      />
      <p className="hidden md:block text-[44px]">MMA Universe</p>
      <p className="block md:hidden text-[30px]">MMA Universe</p>
    </div>
  );
}
