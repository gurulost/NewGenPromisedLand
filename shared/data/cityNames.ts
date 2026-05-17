import { FactionId } from '../types/faction';
import { deriveSeed, SeededRandom } from '../utils/mapGenerationRandom';

/**
 * Book of Mormon themed city names organized by faction
 * Names are drawn from cities, lands, and places mentioned in the text
 */

export const FACTION_CITY_NAMES: Record<FactionId, string[]> = {
    // Nephite cities from the Book of Mormon
    NEPHITES: [
        'Zarahemla',      // Capital of the Nephite nation
        'Bountiful',      // Northern stronghold
        'Nephi',          // Original Nephite city
        'Gideon',         // Valley and city
        'Manti',          // Southern fortification
        'Noah',           // Defended by Captain Moroni
        'Helam',          // Founded by Alma
        'Melek',          // Western settlement
        'Moroni',         // Eastern coastal city
        'Lehi',           // Named for the first prophet
        'Teancum',        // Warrior's memorial
        'Nephihah',       // Large Nephite city
        'Aaron',          // Named for son of Mosiah
        'Joshua',         // Border settlement
        'Cumeni',         // Recaptured from Lamanites
        'Judea',          // Fortified outpost
        'Antiparah',      // Strategic location
    ],

    // Lamanite cities and lands
    LAMANITES: [
        'Lemuel',         // Named for son of Lehi
        'Ishmael',        // Land of Lamanite king
        'Jerusalem',      // Lamanite city (different from Israel)
        'Shemlon',        // Near the Nephite lands
        'Shimnilon',      // Lamanite territory
        'Onidah',         // Place of gathering
        'Amulon',         // Founded by priests of Noah
        'Middoni',        // Where Ammon rescued brethren
        'Ani-Anti',       // Lamanite village
        'Siron',          // Border region
        'Shilom',         // Adjacent to Nephi
        'Nephi',          // Conquered Nephite city
        'Lehi-Nephi',     // Former Nephite territory
        'Midian',         // Lamanite stronghold
        'Laman',          // Ancestral name
    ],

    // Mulekite cities - blending Hebrew and local names
    MULEKITES: [
        'Zarahemla',      // Their great capital
        'Mulek',          // Named for their founder prince
        'Omni',           // Record keeper's memorial
        'Mosiah',         // After the king who united them
        'Jashon',         // Northern outpost
        'Ablom',          // Coastal settlement
        'Shem',           // Land of refuge
        'Coriantumr',     // Named for Jaredite survivor
        'Zedekiah',       // For their ancestral king
        'Ammoron',        // Trading post
        'Benjamin',       // King's memorial
        'Limhi',          // Allied leader
    ],

    // Anti-Nephi-Lehi cities - peaceful, faith-focused names
    ANTI_NEPHI_LEHIES: [
        'Jershon',        // Land given by Nephites
        'Melek',          // Place of refuge
        'Sidom',          // Alma's missionary work
        'Ammon',          // Their great missionary
        'Aaron',          // Son of Mosiah
        'Omner',          // Brother missionary
        'Himni',          // Fourth brother
        'Alma',           // Prophet who taught them
        'Lamoni',         // Converted king
        'Antiomno',       // Lamanite king's father
        'Helam',          // Place of peace
        'Covenant',       // Their sacred promise
        'Shiloh',         // Place of rest
    ],

    // Zoramite cities - prideful, wealth-focused names
    ZORAMITES: [
        'Antionum',       // Their capital land
        'Zoram',          // Named for ancestor
        'Sidom',          // Border with Nephites
        'Ammonihah',      // Apostate city
        'Rameumptom',     // Their holy tower
        'Antionah',       // Learned city
        'Zeezrom',        // Lawyer's memorial
        'Amalickiah',     // Ambitious leader
        'Gadianton',      // Secret society
        'Korihor',        // Anti-Christ memorial
        'Nehor',          // Priestcraft founder
        'Pride',          // Center of worship
    ],

    // Jaredite cities - ancient, powerful names
    JAREDITES: [
        'Moron',          // Capital city
        'Ether',          // Last prophet
        'Coriantumr',     // Final king
        'Ablom',          // Eastern seashore
        'Agosh',          // Plains of
        'Ogath',          // Near final battle
        'Shim',           // Hill of records
        'Heth',           // Ancient ruler
        'Lib',            // Great hunter
        'Riplakish',      // Wicked king
        'Nimrod',         // Valley of
        'Desolation',     // Land of bones
        'Moriancumer',    // Brother of Jared
        'Shule',          // Righteous king
        'Omer',           // Restored ruler
    ],

    // Hagoth's Mariners - coastal and nautical place names
    HAGOTHS_MARINERS: [
        'Irreantum',
        'Hagoth',
        'Shipyard of Bountiful',
        'Northward Haven',
        'Moriantum',
        'Narrow Neck',
        'Narrow Pass',
        'Sidon Mouth',
        'East Sea',
        'West Sea',
        'Cape Moroni',
        'Coast of Nephihah',
        'Many Waters',
    ],

    // Amulonites - priestcraft, bondage, and occupied-land themes
    AMULONITES: [
        'Land of Amulon',
        'Amulon',
        'Tower of Noah',
        "Noah's Court",
        'Shemlon',
        'Shimnilon',
        'Shilom',
        'Waters of Mormon',
        'Helam',
        'Land of Nephi',
        'Lehi-Nephi',
        'Middoni',
        'Bondage Camp',
    ],
};

// Track used names per game to avoid duplicates
const usedNamesPerGame = new Map<string, Set<string>>();

function getDeterministicNameIndex({
    factionId,
    gameId,
    poolSize,
    usedCount,
}: {
    factionId: FactionId;
    gameId: string;
    poolSize: number;
    usedCount: number;
}): number {
    const rng = new SeededRandom(deriveSeed(0, `${gameId}:city-name:${factionId}:${usedCount}`));
    return rng.nextInt(0, Math.max(0, poolSize - 1));
}

/**
 * Get a deterministic city name for a faction.
 * Tracks used names to avoid duplicates within a game session.
 */
export function getRandomCityName(factionId: FactionId, gameId: string = 'default'): string {
    const factionNames = FACTION_CITY_NAMES[factionId];
    if (!usedNamesPerGame.has(gameId)) {
        usedNamesPerGame.set(gameId, new Set());
    }
    const usedNames = usedNamesPerGame.get(gameId)!;

    if (!factionNames || factionNames.length === 0) {
        const fallback = `City ${usedNames.size + 1}`;
        usedNames.add(fallback);
        return fallback;
    }

    // Filter to available names
    const availableNames = factionNames.filter(name => !usedNames.has(name));

    // If all names used, allow duplicates with suffix
    if (availableNames.length === 0) {
        const baseIndex = getDeterministicNameIndex({
            factionId,
            gameId,
            poolSize: factionNames.length,
            usedCount: usedNames.size,
        });
        const suffix = usedNames.size + 2;
        const fallback = `${factionNames[baseIndex]} ${suffix}`;
        usedNames.add(fallback);
        return fallback;
    }

    // Pick a deterministic available name.
    const selectedIndex = getDeterministicNameIndex({
        factionId,
        gameId,
        poolSize: availableNames.length,
        usedCount: usedNames.size,
    });
    const selectedName = availableNames[selectedIndex];
    usedNames.add(selectedName);

    return selectedName;
}

/**
 * Reset used names for a game (call when starting new game)
 */
export function resetCityNames(gameId: string = 'default'): void {
    usedNamesPerGame.delete(gameId);
}

/**
 * Get all available city names for a faction
 */
export function getAvailableCityNames(factionId: FactionId, gameId: string = 'default'): string[] {
    const factionNames = FACTION_CITY_NAMES[factionId];
    const usedNames = usedNamesPerGame.get(gameId) || new Set();
    return factionNames.filter(name => !usedNames.has(name));
}
