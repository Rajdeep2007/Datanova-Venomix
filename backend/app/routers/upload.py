import uuid
import io
import pandas as pd
from fastapi import APIRouter, UploadFile, File, HTTPException

from app.services import stats_engine, session_store
from app.models.schemas import UploadResponse

router = APIRouter()


@router.post("/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...)):
    filename = file.filename.lower()
    allowed_exts = (".csv", ".xls", ".xlsx", ".json", ".pdf")
    if not any(filename.endswith(ext) for ext in allowed_exts):
        raise HTTPException(status_code=400, detail=f"Unsupported file type. Please upload one of: {', '.join(allowed_exts)}")

    contents = await file.read()
    df = None
    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contents))
        elif filename.endswith(".xls") or filename.endswith(".xlsx"):
            try:
                engine = "openpyxl" if filename.endswith(".xlsx") else "xlrd"
                df = pd.read_excel(io.BytesIO(contents), engine=engine)
            except Exception:
                # Fallback if someone saved a CSV file but named it .xls or .xlsx
                df = pd.read_csv(io.BytesIO(contents))
        elif filename.endswith(".json"):
            df = pd.read_json(io.BytesIO(contents))
        elif filename.endswith(".pdf"):
            import pdfplumber
            with pdfplumber.open(io.BytesIO(contents)) as pdf:
                all_tables = []
                for page in pdf.pages:
                    table = page.extract_table()
                    if table:
                        all_tables.extend(table)
                if not all_tables:
                    raise Exception("No tables could be found in the PDF.")
                # Assume first row is header
                df = pd.DataFrame(all_tables[1:], columns=all_tables[0])
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse file: {e}")

    session_id = str(uuid.uuid4())
    session_store.create_session(session_id, df)

    diagnosis = stats_engine.full_diagnosis(df)
    return {"session_id": session_id, "diagnosis": diagnosis}
