import { defineRelations } from "drizzle-orm";

import * as schema from "./schema";

export const relations = {
  ...defineRelations(schema),
  ...schema.authRelations,
  ...schema.goalsRelations,
  ...schema.reminderRelations,
  ...schema.sessionRelations,
  ...schema.settingRelations,
};
