export interface GameFilterOptionDefinition {
  slug: string;
  label: string;
  description: string;
  tagAliases?: string[];
}

export interface GameFilterGroupDefinition {
  key: string;
  attributeKey: string;
  generatorKey: string;
  label: string;
  icon: string;
  multiple: boolean;
  defaultValues: string[];
  generatorDefaultValues: string[];
  options: GameFilterOptionDefinition[];
}

export interface GameFilterConfiguration {
  schemaVersion: 1;
  primaryMatchGroup: string;
  aliases: Record<string, string>;
  groups: GameFilterGroupDefinition[];
}

export type GameFilterAttributes = Record<string, string[]>;
