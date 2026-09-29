import Link from "next/link";
import { usePathname } from "next/navigation";

type SidebarOptionsType = {
    href: string;
    title: string;
};

export default function SidebarOptions({ href, title }: SidebarOptionsType) {
    const pathName = usePathname();
    const isActive = href.includes(pathName) && pathName !== "/";

    return (
        <Link
            href={href}
            className={`relative rounded-md border p-2 ${isActive ? "border-black bg-gray-300 font-bold" : "border-gray-400"}`}
        >
            <p className="truncate">{title}</p>
        </Link>
    );
}
