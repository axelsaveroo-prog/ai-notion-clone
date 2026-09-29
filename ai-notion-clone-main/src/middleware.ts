import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Tentukan rute yang bersifat publik (boleh diakses tanpa login, misal: link Public View MoM & Sign In)
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/mom/(.*)", // Agar link Notulen Public untuk client tetap bisa diakses tanpa login
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Jalankan middleware untuk semua rute kecuali file statis Next.js
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|json|webmanifest|png|jpg|jpeg|gif|svg|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};