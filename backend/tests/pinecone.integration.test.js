import { Pinecone } from '@pinecone-database/pinecone';

describe('Pinecone Integration Tests', () => {
  let pc;
  let denseIndexName = 'test-dense-index';
  let sparseIndexName = 'test-sparse-index';

  beforeAll(async () => {
    // Initialize Pinecone client for local testing
    const apiKey = process.env.PINECONE_API_KEY || 'pclocal';
    const host = process.env.PINECONE_HOST || 'http://localhost:5080';
    
    pc = new Pinecone({
      apiKey: apiKey,
      controllerHostUrl: host
    });
  });

  afterAll(async () => {
    // Cleanup indexes
    try {
      await pc.deleteIndex(denseIndexName);
    } catch (error) {
      // Index might not exist
    }
    try {
      await pc.deleteIndex(sparseIndexName);
    } catch (error) {
      // Index might not exist
    }
  });

  describe('Dense Index Operations', () => {
    it('should create a dense index', async () => {
      const createResponse = await pc.createIndex({
        name: denseIndexName,
        vectorType: 'dense',
        dimension: 2,
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1'
          }
        },
        deletionProtection: 'disabled',
        tags: { environment: 'test' }
      });

      expect(createResponse).toBeDefined();
    });

    it('should describe the dense index', async () => {
      const indexDescription = await pc.describeIndex(denseIndexName);
      
      expect(indexDescription).toBeDefined();
      expect(indexDescription.name).toBe(denseIndexName);
    });

    it('should upsert vectors into dense index', async () => {
      const index = await pc.index(denseIndexName, `http://${(await pc.describeIndex(denseIndexName)).host}`);
      
      await index.namespace('test-namespace').upsert([
        {
          id: 'vec1',
          values: [1.0, -2.5],
          metadata: { genre: 'drama' }
        },
        {
          id: 'vec2',
          values: [3.0, -2.0],
          metadata: { genre: 'documentary' }
        }
      ]);

      const stats = await index.describeIndexStats();
      expect(stats.totalVectorCount).toBeGreaterThan(0);
    });

    it('should query dense index', async () => {
      const index = await pc.index(denseIndexName, `http://${(await pc.describeIndex(denseIndexName)).host}`);
      
      const queryResponse = await index.namespace('test-namespace').query({
        vector: [3.0, -2.0],
        topK: 1,
        includeMetadata: true
      });

      expect(queryResponse.matches).toBeDefined();
      expect(queryResponse.matches.length).toBeGreaterThan(0);
    });
  });

  describe('Sparse Index Operations', () => {
    it('should create a sparse index', async () => {
      const createResponse = await pc.createIndex({
        name: sparseIndexName,
        vectorType: 'sparse',
        metric: 'dotproduct',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1'
          }
        },
        deletionProtection: 'disabled',
        tags: { environment: 'test' }
      });

      expect(createResponse).toBeDefined();
    });

    it('should upsert sparse vectors', async () => {
      const index = await pc.index(sparseIndexName, `http://${(await pc.describeIndex(sparseIndexName)).host}`);
      
      await index.namespace('test-namespace').upsert([
        {
          id: 'vec1',
          sparseValues: {
            indices: [822745112, 1009084850, 1221765879],
            values: [1.7958984, 0.41577148, 2.828125]
          },
          metadata: { 
            chunk_text: 'Test document',
            category: 'technology'
          }
        }
      ]);

      const stats = await index.describeIndexStats();
      expect(stats.totalVectorCount).toBeGreaterThan(0);
    });
  });
});
