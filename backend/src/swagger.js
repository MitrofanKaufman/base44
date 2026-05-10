import { entityDefinitions, getEntitySchema } from './entity-definitions.js';

const authSecurity = [{ bearerAuth: [] }, { cookieAuth: [] }];

const schemas = {
  ErrorResponse: {
    type: 'object',
    properties: {
      error: { type: 'string' }
    },
    required: ['error']
  },
  HealthResponse: {
    type: 'object',
    properties: {
      ok: { type: 'boolean' }
    },
    required: ['ok']
  },
  AuthRegisterRequest: {
    type: 'object',
    properties: {
      email: { type: 'string', format: 'email' },
      full_name: { type: 'string' },
      password: { type: 'string', minLength: 8 },
      role: { type: 'string', enum: ['admin', 'user'] }
    },
    required: ['email', 'full_name', 'password']
  },
  AuthLoginRequest: {
    type: 'object',
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string' }
    },
    required: ['email', 'password']
  },
  AuthResponse: {
    type: 'object',
    properties: {
      token: { type: 'string' },
      user: { $ref: '#/components/schemas/User' }
    },
    required: ['token', 'user']
  },
  QueueEnqueueRequest: {
    type: 'object',
    properties: {
      name: { type: 'string', example: 'sync-product' },
      data: { type: 'object', additionalProperties: true }
    },
    required: ['name']
  },
  QueueEnqueueResponse: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      data: { type: 'object', additionalProperties: true }
    },
    required: ['id', 'name', 'data']
  }
};

for (const [name, def] of Object.entries(entityDefinitions)) {
  const entitySchema = getEntitySchema(def);
  schemas[name] = entitySchema;
  schemas[`${name}Create`] = entitySchema;
  schemas[`${name}Update`] = {
    type: 'object',
    properties: entitySchema.properties
  };
  schemas[`${name}List`] = {
    type: 'array',
    items: { $ref: `#/components/schemas/${name}` }
  };
}

const paths = {
  '/healthz': {
    get: {
      tags: ['System'],
      summary: 'Health check',
      responses: {
        200: {
          description: 'Service is healthy',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/HealthResponse' }
            }
          }
        }
      }
    }
  },
  '/auth/register': {
    post: {
      tags: ['Auth'],
      summary: 'Register user and issue JWT',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/AuthRegisterRequest' }
          }
        }
      },
      responses: {
        201: {
          description: 'Registered',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AuthResponse' }
            }
          }
        },
        400: { description: 'Bad request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        409: { description: 'Conflict', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
      }
    }
  },
  '/auth/login': {
    post: {
      tags: ['Auth'],
      summary: 'Login and issue JWT',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/AuthLoginRequest' }
          }
        }
      },
      responses: {
        200: {
          description: 'Logged in',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AuthResponse' }
            }
          }
        },
        401: { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
      }
    }
  },
  '/auth/logout': {
    post: {
      tags: ['Auth'],
      summary: 'Logout user',
      responses: {
        204: { description: 'Logged out' }
      }
    }
  },
  '/auth/me': {
    get: {
      tags: ['Auth'],
      summary: 'Current authenticated user',
      security: authSecurity,
      responses: {
        200: {
          description: 'Current user',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/User' }
            }
          }
        },
        401: { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
      }
    }
  },
  '/queue/enqueue': {
    post: {
      tags: ['Queue'],
      summary: 'Enqueue a background job',
      security: authSecurity,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/QueueEnqueueRequest' }
          }
        }
      },
      responses: {
        201: {
          description: 'Job queued',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/QueueEnqueueResponse' }
            }
          }
        },
        401: { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
      }
    }
  }
};

for (const [name] of Object.entries(entityDefinitions)) {
  const tag = name;
  const collectionPath = `/entities/${name}`;
  const itemPath = `/entities/${name}/{id}`;
  const bulkPath = `/entities/${name}/bulk`;
  const updateManyPath = `/entities/${name}/update-many`;
  const restorePath = `/entities/${name}/{id}/restore`;

  paths[collectionPath] = {
    get: {
      tags: [tag],
      summary: `List ${name} records`,
      security: authSecurity,
      parameters: [
        { name: 'q', in: 'query', schema: { type: 'string' }, description: 'JSON query filter, e.g. {"status":"active"}' },
        { name: 'limit', in: 'query', schema: { type: 'integer' }, description: 'Maximum number of records to return' },
        { name: 'skip', in: 'query', schema: { type: 'integer' }, description: 'Number of records to skip (pagination)' },
        { name: 'sort_by', in: 'query', schema: { type: 'string' }, description: 'Field name to sort by. Prefix with - for descending order' }
      ],
      responses: {
        200: { description: 'OK', content: { 'application/json': { schema: { $ref: `#/components/schemas/${name}List` } } } },
        401: { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
      }
    },
    post: {
      tags: [tag],
      summary: `Create ${name} record`,
      security: authSecurity,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: `#/components/schemas/${name}Create` }
          }
        }
      },
      responses: {
        201: { description: 'Created', content: { 'application/json': { schema: { $ref: `#/components/schemas/${name}` } } } },
        400: { description: 'Bad request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        401: { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
      }
    },
    delete: {
      tags: [tag],
      summary: `Delete many ${name} records by query`,
      security: authSecurity,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              additionalProperties: true
            }
          }
        }
      },
      responses: {
        200: {
          description: 'Deleted',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { deleted: { type: 'integer' } },
                required: ['deleted']
              }
            }
          }
        },
        400: { description: 'Bad request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
      }
    }
  };

  paths[bulkPath] = {
    post: {
      tags: [tag],
      summary: `Bulk create ${name} records`,
      security: authSecurity,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: { $ref: `#/components/schemas/${name}Create` }
            }
          }
        }
      },
      responses: {
        201: { description: 'Created', content: { 'application/json': { schema: { $ref: `#/components/schemas/${name}List` } } } }
      }
    },
    put: {
      tags: [tag],
      summary: `Bulk update ${name} records`,
      security: authSecurity,
      responses: {
        501: { description: 'Not implemented' }
      }
    }
  };

  paths[updateManyPath] = {
    patch: {
      tags: [tag],
      summary: `Update many ${name} records by query`,
      security: authSecurity,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                query: {
                  type: 'object',
                  additionalProperties: true
                },
                data: { $ref: `#/components/schemas/${name}Update` }
              },
              required: ['query', 'data']
            }
          }
        }
      },
      responses: {
        200: { description: 'Updated', content: { 'application/json': { schema: { $ref: `#/components/schemas/${name}List` } } } }
      }
    }
  };

  paths[itemPath] = {
    get: {
      tags: [tag],
      summary: `Get ${name} record by ID`,
      security: authSecurity,
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        200: { description: 'OK', content: { 'application/json': { schema: { $ref: `#/components/schemas/${name}` } } } },
        404: { description: 'Not found' }
      }
    },
    put: {
      tags: [tag],
      summary: `Update ${name} record`,
      security: authSecurity,
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: `#/components/schemas/${name}Update` }
          }
        }
      },
      responses: {
        200: { description: 'Updated', content: { 'application/json': { schema: { $ref: `#/components/schemas/${name}` } } } },
        404: { description: 'Not found' }
      }
    },
    delete: {
      tags: [tag],
      summary: `Delete ${name} record`,
      security: authSecurity,
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 204: { description: 'Deleted' } }
    }
  };

  paths[restorePath] = {
    put: {
      tags: [tag],
      summary: `Restore a deleted ${name} record`,
      security: authSecurity,
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 501: { description: 'Not implemented for hard-delete mode' } }
    }
  };
}

export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'Base44 API',
    version: '1.0.0',
    description: 'REST API for Base44 application entities'
  },
  servers: [{ url: '/api' }],
  paths,
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      },
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: process.env.AUTH_COOKIE_NAME || 'base44_access_token'
      }
    },
    schemas
  }
};
