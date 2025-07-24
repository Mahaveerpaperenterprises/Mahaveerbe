import nextConnect from 'next-connect';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });

const apiRoute = nextConnect({
  onError(error, req, res) {
    res.status(501).json({ error: `Upload error: ${error.message}` });
  },
  onNoMatch(req, res) {
    res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  },
});

apiRoute.use(upload.single('file'));

apiRoute.post((req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const fakeUrl = `https://example.com/uploads/${file.originalname}`;
  res.status(200).json({ url: fakeUrl });
});

export default apiRoute;

export const config = {
  api: {
    bodyParser: false,
  },
};
