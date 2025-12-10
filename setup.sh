#!/bin/bash

# InsightStock Backend Interactive Setup Script
# 각 단계를 체크하고 필요한 작업만 수행합니다

set -e

echo "🚀 InsightStock Backend Setup"
echo "================================"
echo ""

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 체크 함수
check_step() {
    echo -e "${YELLOW}[CHECK]${NC} $1"
}

success_step() {
    echo -e "${GREEN}[✓]${NC} $1"
}

warn_step() {
    echo -e "${RED}[✗]${NC} $1"
}

ask_proceed() {
    read -p "$(echo -e ${YELLOW}[?]${NC}) $1 (y/N): " -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]]
}

echo "각 단계를 체크하고 필요한 작업만 수행합니다."
echo ""

# =====================================
# 1. Node.js 확인
# =====================================
check_step "1/8 Checking Node.js installation..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    success_step "Node.js is installed: $NODE_VERSION"
else
    warn_step "Node.js is not installed"
    echo "   Please install Node.js 20.x from https://nodejs.org/"
    exit 1
fi
echo ""

# =====================================
# 2. pnpm 확인
# =====================================
check_step "2/8 Checking pnpm installation..."
if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm -v)
    success_step "pnpm is installed: $PNPM_VERSION"
else
    warn_step "pnpm is not installed"
    if ask_proceed "Install pnpm now?"; then
        npm install -g pnpm
        success_step "pnpm installed"
    else
        echo "   Please install pnpm: npm install -g pnpm"
        exit 1
    fi
fi
echo ""

# =====================================
# 3. 의존성 설치 확인
# =====================================
check_step "3/8 Checking dependencies (node_modules)..."
if [ -d "node_modules" ]; then
    success_step "Dependencies are installed"
    if ask_proceed "Reinstall dependencies?"; then
        rm -rf node_modules
        pnpm install
        success_step "Dependencies reinstalled"
    fi
else
    warn_step "Dependencies not installed"
    if ask_proceed "Run pnpm install?"; then
        pnpm install
        success_step "Dependencies installed"
    else
        echo "   Skipping dependency installation"
        exit 1
    fi
fi
echo ""

# =====================================
# 4. 환경 변수 파일 확인
# =====================================
check_step "4/8 Checking .env file..."
if [ -f ".env" ]; then
    success_step ".env file exists"
    echo "   Current settings:"
    grep -E "^(DATABASE_URL|PORT|OPENAI_API_KEY)" .env | sed 's/=.*/=***/' || echo "   (no key variables found)"
else
    warn_step ".env file not found"
    if ask_proceed "Create .env file from .env.example?"; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            success_step ".env file created"
            echo "   ⚠️  Please edit .env file with your configuration:"
            echo "      - DATABASE_URL (required)"
            echo "      - OPENAI_API_KEY (for chat feature)"
        else
            echo "   .env.example not found. Creating basic .env..."
            cat > .env << EOF
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
DATABASE_URL="postgresql://user:password@localhost:5432/insightstock"
OPENAI_API_KEY=your-api-key-here
EOF
            success_step ".env file created with defaults"
        fi

        if ask_proceed "Open .env file in editor?"; then
            ${EDITOR:-nano} .env
        fi
    fi
fi
echo ""

# =====================================
# 5. PostgreSQL 연결 확인
# =====================================
check_step "5/8 Checking PostgreSQL connection..."
if command -v psql &> /dev/null; then
    success_step "PostgreSQL client (psql) is installed"

    # DATABASE_URL에서 DB 이름 추출
    if [ -f ".env" ]; then
        DB_NAME=$(grep DATABASE_URL .env | grep -o '/[^?]*' | cut -d'/' -f2 | cut -d'?' -f1)
        if [ ! -z "$DB_NAME" ]; then
            echo "   Database name from .env: $DB_NAME"

            # DB 존재 확인 (로컬 PostgreSQL만)
            if psql -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
                success_step "Database '$DB_NAME' exists"
            else
                warn_step "Database '$DB_NAME' does not exist"
                if ask_proceed "Create database '$DB_NAME'?"; then
                    createdb "$DB_NAME" 2>/dev/null && success_step "Database created" || warn_step "Failed to create database (check PostgreSQL is running)"
                fi
            fi
        fi
    fi
else
    warn_step "PostgreSQL client not found"
    echo "   Make sure PostgreSQL is installed and running"
    echo "   Or using a remote database (update DATABASE_URL in .env)"
fi
echo ""

# =====================================
# 6. Prisma Client 생성
# =====================================
check_step "6/8 Checking Prisma Client..."
if [ -d "node_modules/.prisma" ]; then
    success_step "Prisma Client is generated"
    if ask_proceed "Regenerate Prisma Client?"; then
        pnpm db:generate
        success_step "Prisma Client regenerated"
    fi
else
    warn_step "Prisma Client not generated"
    if ask_proceed "Generate Prisma Client?"; then
        pnpm db:generate
        success_step "Prisma Client generated"
    else
        echo "   Skipping Prisma Client generation"
    fi
fi
echo ""

# =====================================
# 7. 데이터베이스 스키마 동기화
# =====================================
check_step "7/8 Checking database schema..."
warn_step "Cannot auto-check if schema is synced"
if ask_proceed "Push database schema to DB? (creates/updates tables)"; then
    pnpm db:push --accept-data-loss
    success_step "Database schema synced"
else
    echo "   Skipping database schema sync"
    echo "   ⚠️  Run 'pnpm db:push' manually when ready"
fi
echo ""

# =====================================
# 8. Seed 데이터 주입
# =====================================
check_step "8/8 Checking seed data..."
warn_step "Cannot auto-check if seed data exists"
if ask_proceed "Seed database with sample data?"; then
    echo "   Available seed scripts:"
    echo "   - News seed (sample news articles)"
    echo "   - Notes seed (sample notes with highlights)"
    echo ""

    if ask_proceed "   Seed news data?"; then
        pnpm db:seed:news && success_step "News data seeded" || warn_step "News seed failed"
    fi

    if ask_proceed "   Seed notes data?"; then
        pnpm db:seed:notes && success_step "Notes data seeded" || warn_step "Notes seed failed"
    fi
else
    echo "   Skipping database seed"
fi
echo ""

# =====================================
# 완료
# =====================================
echo "================================"
echo -e "${GREEN}✅ Setup process complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Review .env file: cat .env"
echo "  2. Start dev server: pnpm dev"
echo "  3. Server will run at: http://localhost:3001"
echo ""
echo "Optional commands:"
echo "  - pnpm db:studio   (view database in Prisma Studio)"
echo "  - pnpm db:push     (sync schema changes)"
echo "  - pnpm db:seed     (run all seed scripts)"
echo ""
