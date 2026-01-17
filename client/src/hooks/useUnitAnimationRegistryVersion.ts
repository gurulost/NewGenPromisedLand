import { useSyncExternalStore } from "react";
import {
  getUnitAnimationRegistryVersion,
  subscribeUnitAnimationRegistry,
} from "../utils/unitAnimationRegistry";

export const useUnitAnimationRegistryVersion = (): number =>
  useSyncExternalStore(subscribeUnitAnimationRegistry, getUnitAnimationRegistryVersion);
