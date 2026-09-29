import "server-only";

import { Liveblocks } from "@liveblocks/node";

import { env } from "@/env/server";

const liveblocks = new Liveblocks({
    secret: env.LIVEBLOCKS_PRIVATE_KEY,
});

export default liveblocks;
