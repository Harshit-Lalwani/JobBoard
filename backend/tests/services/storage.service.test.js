import { jest } from "@jest/globals";

// storage.service.js dynamically `import()`s @google-cloud/storage inside saveFile (only when
// GCS_BUCKET is set), rather than importing it statically at module load — so the mock just needs
// to be registered before saveFile() is actually called, not before storage.service.js itself is
// imported. No real GCP credentials/bucket needed to verify this branch's logic.
const mockSave = jest.fn().mockResolvedValue(undefined);
const mockFile = jest.fn(() => ({ save: mockSave }));
const mockBucket = jest.fn(() => ({ file: mockFile }));
const MockStorage = jest.fn().mockImplementation(() => ({ bucket: mockBucket }));

jest.unstable_mockModule("@google-cloud/storage", () => ({ Storage: MockStorage }));

const { saveFile } = await import("../../src/services/storage.service.js");

const pdfFile = {
  originalname: "resume.pdf",
  mimetype: "application/pdf",
  buffer: Buffer.from("%PDF-1.4 fake resume content"),
};

describe("saveFile — Google Cloud Storage backend", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GCS_BUCKET = "test-resumes-bucket";
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("uploads to the configured bucket and returns a public storage.googleapis.com URL", async () => {
    const url = await saveFile(pdfFile);

    expect(mockBucket).toHaveBeenCalledWith("test-resumes-bucket");
    expect(mockFile).toHaveBeenCalledWith(expect.stringMatching(/^[0-9a-f-]+\.pdf$/));
    expect(mockSave).toHaveBeenCalledWith(pdfFile.buffer, { contentType: "application/pdf" });
    expect(url).toMatch(/^https:\/\/storage\.googleapis\.com\/test-resumes-bucket\/[0-9a-f-]+\.pdf$/);
  });

  it("constructs the Storage client with no explicit credentials when GOOGLE_APPLICATION_CREDENTIALS_JSON is unset", async () => {
    await saveFile(pdfFile);

    expect(MockStorage).toHaveBeenCalledWith();
  });

  it("parses and passes GOOGLE_APPLICATION_CREDENTIALS_JSON to the Storage client when set", async () => {
    const credentials = { client_email: "test@test.iam.gserviceaccount.com", private_key: "fake-key" };
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = JSON.stringify(credentials);

    await saveFile(pdfFile);

    expect(MockStorage).toHaveBeenCalledWith({ credentials });
  });

  it("takes priority over Vercel Blob when both GCS_BUCKET and BLOB_READ_WRITE_TOKEN are set", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "fake-vercel-blob-token";

    const url = await saveFile(pdfFile);

    expect(MockStorage).toHaveBeenCalled();
    expect(url).toContain("storage.googleapis.com");
  });

  it("generates a distinct filename per upload", async () => {
    await saveFile(pdfFile);
    await saveFile(pdfFile);

    const [firstFilename] = mockFile.mock.calls[0];
    const [secondFilename] = mockFile.mock.calls[1];
    expect(firstFilename).not.toBe(secondFilename);
  });
});
