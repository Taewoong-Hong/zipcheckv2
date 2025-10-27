# IROS Registry Document Processing Workflow

Complete workflow for processing IROS registry documents (PS/PDF format) with automatic conversion and database storage.

## Overview

IROS (Internet Registry Office System) provides registry documents in **PS (PostScript)** format. This workflow automatically:
1. Detects downloaded PS or PDF files
2. Converts PS to PDF if needed
3. Saves to Supabase Storage
4. Records metadata in database
5. Returns public URL for viewing

## Architecture

```
IROS Website (발급 버튼)
    ↓
PS/PDF File Downloaded
    ↓
IROSDocumentHandler
    ├─ Auto-detect file in Downloads folder
    ├─ PSToPDFConverter (if PS file)
    │   ├─ Try PyMuPDF (fitz)
    │   ├─ Try Ghostscript
    │   └─ Try ps2pdf command
    ├─ Copy to project downloads folder
    └─ Save to Supabase
        ├─ Upload to Storage (registry_documents bucket)
        ├─ Save metadata to v2_documents table
        └─ Return public URL
```

## Components

### 1. PS to PDF Converter (`ps_to_pdf_converter.py`)

**Purpose**: Convert PostScript files to PDF format

**Features**:
- Multiple conversion methods (PyMuPDF, Ghostscript, ps2pdf)
- Automatic fallback if one method fails
- Error handling and logging
- File validation

**Usage**:
```python
from ps_to_pdf_converter import PSToPDFConverter

converter = PSToPDFConverter()
pdf_path = converter.convert("input.ps", "output.pdf")
```

**Conversion Methods** (in order of preference):
1. **PyMuPDF (fitz)**: Python library, fastest
2. **Ghostscript**: Industry standard, most reliable
3. **ps2pdf**: Command-line tool (if available)

### 2. IROS Document Handler (`iros_pdf_handler.py`)

**Purpose**: Complete document processing workflow

**Features**:
- Auto-detect latest PS/PDF file in Downloads
- Convert PS to PDF if needed
- Save to Supabase Storage
- Record metadata in database
- Return public URL

**Usage**:
```python
from iros_pdf_handler import complete_iros_flow

success, pdf_url = await complete_iros_flow(
    user_id="user123",
    property_address="서울특별시 동작구 남부순환로257길 33",
    wait_for_download=60
)

if success:
    print(f"PDF URL: {pdf_url}")
```

### 3. Test Runner (`run_conversion.py`)

**Purpose**: Simple script to test the complete workflow

**Usage**:
```bash
cd services/ai/rpa
python run_conversion.py
```

## Installation

### Required Python Packages
```bash
pip install pymupdf  # For PS to PDF conversion
pip install pyautogui pillow  # For UI automation
```

### Optional: Ghostscript (Recommended)
Download and install from: https://www.ghostscript.com/download/gsdnld.html

## Usage Workflow

### Step 1: Complete IROS RPA Flow (Previous Steps)
1. Login to IROS
2. Search for property
3. Select issuance option (발급)
4. Complete payment
5. Click "발급" button

### Step 2: PS/PDF Processing (New)

After clicking "발급" button in IROS:

**Option A: Automatic (Recommended)**
```python
from iros_pdf_handler import complete_iros_flow

# Will auto-detect PS/PDF file and process
success, url = await complete_iros_flow(
    user_id="user_id",
    property_address="property_address",
    wait_for_download=60  # Wait up to 60 seconds
)
```

**Option B: Manual File Specification**
```python
from iros_pdf_handler import IROSDocumentHandler

handler = IROSDocumentHandler()

# Process specific file
success, pdf_path = handler.process_document(
    file_path=Path("path/to/file.ps")
)

# Save to database
await handler.save_to_database(
    pdf_path=pdf_path,
    user_id="user_id",
    property_address="property_address"
)
```

### Step 3: Display to User

The returned `pdf_url` can be used to display the document:

```typescript
// Frontend (Next.js)
import PDFViewer from '@/components/pdf/PDFViewer';

<PDFViewer pdfUrl={pdfUrl} />
```

## Database Schema

### v2_documents Table

```sql
CREATE TABLE v2_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    property_address TEXT NOT NULL,
    document_type TEXT NOT NULL,  -- 'registry_certificate'
    file_url TEXT NOT NULL,  -- Supabase Storage public URL
    file_path TEXT NOT NULL,  -- Storage path
    file_size INTEGER NOT NULL,  -- Bytes
    status TEXT NOT NULL,  -- 'completed'
    payment_amount INTEGER,  -- 1000 won
    payment_method TEXT,  -- 'prepaid_electronic'
    issued_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Supabase Storage

**Bucket**: `registry_documents`
**Path Pattern**: `{user_id}/{filename}.pdf`
**Public Access**: Enabled (with RLS policies)

## Error Handling

### Common Issues

#### 1. PS File Not Found
```
ERROR: No recent documents found within 60s
```
**Solution**:
- Increase `wait_for_download` parameter
- Check Downloads folder manually
- Ensure file was actually downloaded

#### 2. Conversion Failed
```
ERROR: All conversion methods failed
```
**Solution**:
- Install Ghostscript
- Check if PyMuPDF is installed correctly
- Verify PS file is not corrupted

#### 3. Database Upload Failed
```
ERROR: Storage upload error
```
**Solution**:
- Check Supabase credentials
- Verify Storage bucket exists
- Check RLS policies

## Configuration

### Environment Variables

```bash
# .env file
DATABASE_URL=postgresql://...  # Supabase Postgres URL
SUPABASE_URL=https://...
SUPABASE_KEY=...
```

### File Locations

```
services/ai/rpa/
├── ps_to_pdf_converter.py       # PS to PDF conversion
├── iros_pdf_handler.py          # Complete workflow handler
├── run_conversion.py            # Simple test runner
├── test_ps_conversion.py        # Interactive test menu
├── downloads/                   # Local storage for processed PDFs
└── IROS_PS_PDF_WORKFLOW.md     # This file
```

## Testing

### Quick Test
```bash
# Download a registry document from IROS first, then:
cd services/ai/rpa
python run_conversion.py
```

### Interactive Test
```bash
python test_ps_conversion.py
# Select option 1, 2, or 3 from menu
```

### Unit Test (Single File)
```python
from ps_to_pdf_converter import convert_iros_registry_ps

pdf_path = convert_iros_registry_ps("test.ps")
print(f"PDF created: {pdf_path}")
```

## Performance

- **PS to PDF Conversion**: 1-3 seconds (typical registry document)
- **Database Upload**: 2-5 seconds (depends on file size and network)
- **Total Time**: 5-10 seconds (end-to-end)

## Troubleshooting

### Debug Mode
Enable verbose logging:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Check Conversion Methods
```python
from ps_to_pdf_converter import PSToPDFConverter

converter = PSToPDFConverter()
pdf_path = converter.convert("test.ps")
print(f"Method used: {converter.conversion_method}")
```

### Manual Verification
```bash
# Check if Ghostscript is available
gswin64c.exe -version  # Windows
gs -version             # Linux/Mac

# Check Downloads folder
ls -lt ~/Downloads/*.ps
ls -lt ~/Downloads/*.pdf
```

## Future Enhancements

1. **Batch Processing**: Handle multiple documents at once
2. **OCR Integration**: Extract text from scanned registry documents
3. **Metadata Extraction**: Parse property details from PDF
4. **Compression**: Optimize PDF file size
5. **Thumbnails**: Generate preview images
6. **Caching**: Store converted PDFs temporarily

## API Integration

### FastAPI Endpoint (Future)

```python
@app.post("/api/registry/process")
async def process_registry_document(
    user_id: str,
    property_address: str
):
    """Process IROS registry document"""
    success, url = await complete_iros_flow(
        user_id=user_id,
        property_address=property_address
    )

    return {
        "success": success,
        "pdf_url": url
    }
```

## References

- [Ghostscript Documentation](https://www.ghostscript.com/doc/current/Use.htm)
- [PyMuPDF Documentation](https://pymupdf.readthedocs.io/)
- [PostScript Language Reference](https://www.adobe.com/jp/print/postscript/pdfs/PLRM.pdf)
- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)

---

**Last Updated**: 2025-01-27
**Version**: 1.0.0
**Status**: Production Ready ✅
