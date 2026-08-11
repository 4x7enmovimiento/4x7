import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("idx_users_email").on(table.email)]);

export const userProfiles = sqliteTable("user_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  objective: text("objective", { enum: ["lose_fat", "gain_muscle", "maintain", "general_fitness"] }).notNull().default("general_fitness"),
  birthDate: text("birth_date"),
  sex: text("sex", { enum: ["female", "male", "other", "prefer_not"] }),
  heightCm: real("height_cm"),
  targetWeightKg: real("target_weight_kg"),
  weeklyGoal: integer("weekly_goal").notNull().default(4),
  timezone: text("timezone").notNull().default("America/Mexico_City"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("idx_user_profiles_user_id").on(table.userId)]);

export const families = sqliteTable("families", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull(),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("idx_families_invite_code").on(table.inviteCode)]);

export const familyMembers = sqliteTable("family_members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  familyId: integer("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
  joinedAt: text("joined_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_family_members_family_user").on(table.familyId, table.userId),
  index("idx_family_members_user_id").on(table.userId),
]);

export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("idx_sessions_token_hash").on(table.tokenHash)]);

export const workouts = sqliteTable("workouts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  familyId: integer("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
  activityType: text("activity_type").notNull(),
  startedAt: text("started_at").notNull(),
  endedAt: text("ended_at").notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
  distanceMeters: real("distance_meters").notNull().default(0),
  steps: integer("steps").notNull().default(0),
  calories: integer("calories").notNull().default(0),
  evidenceKey: text("evidence_key"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_workouts_family_started").on(table.familyId, table.startedAt)]);

export const posts = sqliteTable("posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  familyId: integer("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  workoutId: integer("workout_id").references(() => workouts.id, { onDelete: "set null" }),
  caption: text("caption").notNull().default(""),
  evidenceKey: text("evidence_key"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_posts_family_created").on(table.familyId, table.createdAt)]);

export const postLikes = sqliteTable("post_likes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  postId: integer("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("idx_post_likes_post_user").on(table.postId, table.userId)]);

export const postComments = sqliteTable("post_comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  postId: integer("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_post_comments_post_created").on(table.postId, table.createdAt)]);

export const calendarEvents = sqliteTable("calendar_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  familyId: integer("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  activityType: text("activity_type").notNull(),
  scheduledAt: text("scheduled_at").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(30),
  status: text("status", { enum: ["planned", "completed", "cancelled"] }).notNull().default("planned"),
  workoutId: integer("workout_id").references(() => workouts.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_calendar_events_user_scheduled").on(table.userId, table.scheduledAt)]);

export const bodyMeasurements = sqliteTable("body_measurements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  weightKg: real("weight_kg"),
  waistCm: real("waist_cm"),
  chestCm: real("chest_cm"),
  hipCm: real("hip_cm"),
  armCm: real("arm_cm"),
  thighCm: real("thigh_cm"),
  calfCm: real("calf_cm"),
  neckCm: real("neck_cm"),
  bodyFatPercent: real("body_fat_percent"),
  source: text("source", { enum: ["manual", "ai_photo", "health_platform"] }).notNull().default("manual"),
  evidenceKey: text("evidence_key"),
  recordedAt: text("recorded_at").notNull(),
}, (table) => [index("idx_body_measurements_user_recorded").on(table.userId, table.recordedAt)]);

export const challenges = sqliteTable("challenges", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  familyId: integer("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
  createdBy: integer("created_by").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  metric: text("metric", { enum: ["workouts", "steps", "minutes", "streak"] }).notNull(),
  targetValue: integer("target_value").notNull(),
  rewardPoints: integer("reward_points").notNull().default(0),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at").notNull(),
  status: text("status", { enum: ["draft", "active", "completed", "cancelled"] }).notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_challenges_family_status").on(table.familyId, table.status)]);

export const challengeParticipants = sqliteTable("challenge_participants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  challengeId: integer("challenge_id").notNull().references(() => challenges.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  progress: integer("progress").notNull().default(0),
  completedAt: text("completed_at"),
  joinedAt: text("joined_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("idx_challenge_participants_challenge_user").on(table.challengeId, table.userId)]);

export const pointsLedger = sqliteTable("points_ledger", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  familyId: integer("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  points: integer("points").notNull(),
  reason: text("reason").notNull(),
  sourceType: text("source_type", { enum: ["workout", "challenge", "streak", "badge", "adjustment"] }).notNull(),
  sourceId: integer("source_id"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_points_ledger_family_user_created").on(table.familyId, table.userId, table.createdAt)]);
