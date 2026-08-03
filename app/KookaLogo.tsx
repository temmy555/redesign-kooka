import Image from "next/image";

export const KOOKA_LOGO_SRC = "/images/kooka-logo-official.png";

export default function KookaLogo({
  className,
  priority = false,
  sizes,
}: {
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  return (
    <Image
      alt="KOOKA Residence"
      className={className}
      height={180}
      priority={priority}
      sizes={sizes}
      src={KOOKA_LOGO_SRC}
      width={520}
    />
  );
}
