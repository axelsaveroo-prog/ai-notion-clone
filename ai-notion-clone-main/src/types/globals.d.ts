import { User } from "./types";

declare global {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface CustomJwtSessionClaims extends User {}
}
