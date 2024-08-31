import { autenticarToken } from "./Auth";
import { storage } from "../services/firebase";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "firebase/storage";
import multer from "multer";
import { MultipartFile } from "@fastify/multipart";
const upload = multer({ storage: multer.memoryStorage() });
import { z } from "zod";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { prisma } from "../lib/prisma";
import crypto from "crypto";

async function uploadFileAndGetURL(file: any): Promise<string> {
  const allowedMimeTypes = [
    "image/png",
    "image/jpeg",
    "application/pdf",
    "image/jpg"
  ];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw new Error(
      "Invalid file type. Only PNG, JPEG, JPG and PDF are accepted."
    );
  }

  const randomFilename = crypto.randomUUID();
  const storageRef = ref(storage, `proofOfPayment/${randomFilename}`);

  try {
    await uploadBytes(storageRef, await file.toBuffer(), {
      contentType: file.mimetype
    });
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    throw error;
  }
}

export async function uploadProofsOfPayment(app: FastifyInstance) {
  await app.register(import('@fastify/multipart'), {
    limits: {
      fileSize: 20971520 // 20MB
    }
  });

  app.withTypeProvider<ZodTypeProvider>().post(
    "/proofs-of-payment/upload/:id",
    {
      schema: {
        preHandler: [
          // autenticarToken
          upload.single("profilePhoto")
        ],
        params: z.object({
          id: z.string().uuid()
        }),
        headers: z.object({
          authorization: z.string().optional()
        }),
        response: {
          200: z.object({
            message: z.string()
          }),
          400: z.object({
            message: z.string()
          }),
          500: z.object({
            message: z.string()
          })
        }
      }
    },
    async (request, reply) => {
      const { id } = request.params;
      const file = (await (request as any).file()) as MultipartFile;

      if (!file) {
        return reply.status(400).send({ message: "File not found" });
      }

      let searchOrder = await prisma.order.findUnique({
        where: { id },
        select: {
          proofOfPayment: {
            select: {
              link: true
            }
          }
        }
      });

      const imageQrCodeProofOfPayment = await uploadFileAndGetURL(file);

      if (searchOrder && searchOrder.proofOfPayment?.link != null) {
        const storageRef = ref(storage, `${searchOrder.proofOfPayment?.link}`);
        await deleteObject(storageRef);
      }
      
      const createProofOfPayment = await prisma.proofOfPayment.upsert({
        where: { orderId: id },
        update: {
          link: imageQrCodeProofOfPayment
        },
        create: {
          orderId: id,
          link: imageQrCodeProofOfPayment
        }
      });

      if (!createProofOfPayment) {
        return reply.status(400).send({ message: "QR Code not found" });
      }
      

      return reply.status(200).send({ message: "File uploaded" });
    }
  );
}