import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

export function formatZodErrors(error: ZodError) {
  return error.issues.reduce<Record<string, string[]>>((acc, curr) => {
    const field = curr.path.join('.') || 'general';
    if (!acc[field]) acc[field] = [];
    acc[field].push(curr.message);
    return acc;
  }, {});
}

export async function validateRequestBody<T>(
  req: NextRequest,
  schema: z.ZodSchema<T>
): Promise<
  { success: true; data: T } | { success: false; response: NextResponse }
> {
  try {
    const rawBody = await req.json();
    const result = schema.safeParse(rawBody);

    if (!result.success) {
      return {
        success: false,
        response: NextResponse.json(
          {
            success: false,
            message: 'Validation failed',
            errors: formatZodErrors(result.error),
          },
          { status: 422 }
        ),
      };
    }

    return { success: true, data: result.data };
  } catch {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, message: 'Invalid JSON payload' },
        { status: 400 }
      ),
    };
  }
}
