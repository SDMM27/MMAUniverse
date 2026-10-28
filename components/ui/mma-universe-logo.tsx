import Image from 'next/image';

export default function MMAUniverseLogo() {
  return (
    <Image
      alt="MMA Universe"
      width={400}
      height={339}
      priority
      // Static file in public/ — served as-is so it doesn't depend on the
      // Vercel image-optimization quota.
      unoptimized
      className="h-16 w-auto lg:h-[76px]"
      src="/logo-mma-universe.png"
    />
  );
}
