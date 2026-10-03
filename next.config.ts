import type { NextConfig } from "next";
import os from "os";

// Dynamically generate all local network IP addresses and subnets so cross-origin
// dev access (/_next/hmr, live reload, mobile testing) is never blocked.
function getAllowedDevOrigins(): string[] {
  const origins = new Set<string>([
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "*.local",
    "192.168.31.36",
    "192.168.31.36:3000",
    "192.168.31.36:3001",
  ]);

  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === "IPv4" && !iface.internal) {
          const ip = iface.address;
          origins.add(ip);
          origins.add(`${ip}:3000`);
          origins.add(`${ip}:3001`);

          // Allow the entire /24 subnet for this local network interface
          const parts = ip.split(".");
          if (parts.length === 4) {
            const subnetPrefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
            for (let i = 1; i <= 254; i++) {
              origins.add(`${subnetPrefix}.${i}`);
              origins.add(`${subnetPrefix}.${i}:3000`);
              origins.add(`${subnetPrefix}.${i}:3001`);
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn("Failed to harvest local network interfaces for allowedDevOrigins:", e);
  }

  return Array.from(origins);
}

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  allowedDevOrigins: getAllowedDevOrigins(),
};

export default nextConfig;
