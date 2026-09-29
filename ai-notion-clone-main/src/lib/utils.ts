import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function stripAllTags(text: string): string {
    let result = "";
    const resultArr = [];
    let ignore = false;
    for (let i = 0; i < text.length; i += 1) {
        if (text[i] == ">") {
            ignore = false;
            continue;
        }
        if (text[i] == "<") {
            if (result.length !== 0) {
                resultArr.push(result);
                result = "";
            }
            ignore = true;
            continue;
        }
        if (ignore) continue;
        result += text[i];
    }

    return resultArr.join("\n");
}
