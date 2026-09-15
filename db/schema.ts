import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const club=sqliteTable('club',{id:integer('id').primaryKey(),version:integer('version').notNull().default(0),data:text('data').notNull()});
export const managers=sqliteTable('managers',{username:text('username').primaryKey(),salt:text('salt').notNull(),hash:text('hash').notNull()});
export const sessions=sqliteTable('sessions',{token:text('token').primaryKey(),username:text('username').notNull(),expires:integer('expires').notNull()});
export const attempts=sqliteTable('attempts',{key:text('key').primaryKey(),count:integer('count').notNull(),until:integer('until').notNull()});
