import { usePathname } from "next/navigation";
import { Fragment } from "react";

import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default function Breadcrumbs() {
    const path = usePathname();

    const segments = path.split("/");
    return (
        <Breadcrumb>
            <BreadcrumbList>
                <BreadcrumbItem>
                    <BreadcrumbLink href="/">Home</BreadcrumbLink>
                </BreadcrumbItem>
                {segments.map((segment, index) => {
                    if (!segment) return null;
                    const href = `/${segments.slice(1, index + 1).join("/")}`;
                    return (
                        <Fragment key={index}>
                            <BreadcrumbSeparator />
                            <BreadcrumbItem key={index}>
                                {index === segments.length - 1 ? (
                                    <BreadcrumbPage>{segment}</BreadcrumbPage>
                                ) : (
                                    <BreadcrumbLink href={href}>
                                        {segment}
                                    </BreadcrumbLink>
                                )}
                            </BreadcrumbItem>
                        </Fragment>
                    );
                })}
            </BreadcrumbList>
        </Breadcrumb>
    );
}
