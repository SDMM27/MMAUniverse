import Image from 'next/image';

export default function MMAUniverseLogo() {
  return (
    <Image
      alt="MMA Universe"
      width={400}
      height={339}
      priority
      className="h-16 w-auto lg:h-[76px]"
      src="/logo-mma-universe.png"
    />
  );
}
