import type { NavGroup, NavItem } from "../RoleLayout";

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "RS";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function matchesNav(pathname: string, item: NavItem) {
  return item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + "/");
}

export function findActiveGroup(pathname: string, groups: NavGroup[]): NavGroup | undefined {
  return groups.find((group) => group.children.some((item) => matchesNav(pathname, item)));
}

export function findActiveItem(
  pathname: string,
  main: NavItem[],
  groups: NavGroup[],
): NavItem | undefined {
  return [...main, ...groups.flatMap((group) => group.children)].find((item) =>
    matchesNav(pathname, item),
  );
}

export type NavMatch = { item: NavItem; group?: NavGroup };

/**
 * Pencocokan longgar untuk halaman turunan (mis. /admin/item/stok/12) supaya
 * breadcrumb tetap menampilkan judul modul yang benar.
 */
export function findLooseMatch(pathname: string, main: NavItem[], groups: NavGroup[]): NavMatch | undefined {
  const candidates: NavMatch[] = [
    ...main.map((item) => ({ item })),
    ...groups.flatMap((group) => group.children.map((item) => ({ item, group }))),
  ];

  return candidates
    .filter(({ item }) => pathname.startsWith(item.to + "/"))
    .sort((a, b) => b.item.to.length - a.item.to.length)[0];
}

export type PaletteEntry = {
  item: NavItem;
  group: string;
  groupLabel: string;
  description?: string;
};

export function buildPaletteEntries(main: NavItem[], groups: NavGroup[]): PaletteEntry[] {
  const entries: PaletteEntry[] = main.map((item) => ({
    item,
    group: "main",
    groupLabel: "Utama",
    description: item.description,
  }));

  for (const group of groups) {
    for (const item of group.children) {
      entries.push({
        item,
        group: group.label,
        groupLabel: group.label,
        description: item.description,
      });
    }
  }

  return entries;
}
