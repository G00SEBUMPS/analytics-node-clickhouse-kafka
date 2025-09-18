import { Sequelize, DataTypes, Model } from 'sequelize';
import { randomBytes } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';

// Initialize Sequelize for SQLite
export const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'db/analytics.db',
  logging: false,
});

export class ApiKey extends Model {}
ApiKey.init({
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: () => uuidv4(),
    allowNull: false
  },
  key: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
    defaultValue: () => 'ak_' + randomBytes(32).toString('hex')
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  allowed_ips: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: null,
    get() {
      const raw = this.getDataValue('allowed_ips');
      return raw ? JSON.parse(raw) : null;
    },
    set(val) {
      this.setDataValue('allowed_ips', val ? JSON.stringify(val) : null);
    },
  },
  rate_limit_requests: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1000,
    validate: {
      min: 1
    }
  },
  rate_limit_window: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 60,
    validate: {
      min: 1
    }
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  sequelize,
  modelName: 'ApiKey',
  tableName: 'api_keys',
  timestamps: false,
});

export class RateLimitCounter extends Model {}
RateLimitCounter.init({
  api_key_id: {
    type: DataTypes.UUID,
    primaryKey: true,
    references: {
      model: ApiKey,
      key: 'id',
    },
  },
  window_start: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  request_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, {
  sequelize,
  modelName: 'RateLimitCounter',
  tableName: 'rate_limit_counters',
  timestamps: false,
});

// Setup associations
ApiKey.hasMany(RateLimitCounter, { foreignKey: 'api_key_id' });
RateLimitCounter.belongsTo(ApiKey, { foreignKey: 'api_key_id' });

// Sync models with database
export async function syncModels() {
  await sequelize.sync();
}
