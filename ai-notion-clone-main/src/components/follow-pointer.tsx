import { motion } from "framer-motion";

import { stringToColor } from "@/lib/string-to-color";

type FollowPointerType = {
    info: Liveblocks["UserMeta"]["info"];
    x: number;
    y: number;
};

export default function FollowPointer({ x, y, info }: FollowPointerType) {
    const color = stringToColor(info.email || "1");
    return (
        <motion.div
            className="absolute"
            style={{ top: y, left: x, pointerEvents: "none" }}
            initial={{ scale: 1, opacity: 1 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
        >
            <svg
                stroke={color}
                fill={color}
                strokeWidth="1"
                viewBox="0 0 16 16"
                className={`h-6 w-6 text-[${color}] -translate-x-[12px] -translate-y-[10px] -rotate-[70deg] transform stroke-[${color}]`}
                height="1em"
                width="1em"
                xmlns="http://www.w3.org/2000/svg"
            >
                <path d="M14.082 2.182a.5.5 0 0 1 .103.557L8.528 15.467a.5.5 0 0 1-.917-.007L5.57 10.694.803 8.652a.5.5 0 0 1-.006-.916l12.728-5.657a.5.5 0 0 1 .556.103z"></path>
            </svg>
            <motion.div>{info.name || info.email}</motion.div>
        </motion.div>
    );
}
