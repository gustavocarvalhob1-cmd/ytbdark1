@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Estudio Dark - Publicar na internet

echo ==================================================
echo    PUBLICAR O ESTUDIO DARK NA INTERNET (Vercel)
echo ==================================================
echo.
echo Voce vai fazer isso so uma vez. Depois, pra atualizar,
echo e so rodar este arquivo de novo.
echo.
echo Tenha em maos:
echo   - a sua chave da Anthropic (a mesma que voce ja usou)
echo   - uma senha que voce vai INVENTAR pro site
echo.
pause

echo.
echo --------------------------------------------------
echo  PASSO 1 de 4: Entrar na sua conta Vercel
echo  Vai abrir o navegador. Entre com Google, GitHub ou email.
echo  Se nao tiver conta, ele mesmo cria na hora (e de graca).
echo --------------------------------------------------
call vercel login
if errorlevel 1 goto erro

echo.
echo --------------------------------------------------
echo  PASSO 2 de 4: Criar o projeto e subir a 1a versao
echo  Vao aparecer algumas perguntas. So apertar ENTER em todas.
echo --------------------------------------------------
call vercel
if errorlevel 1 goto erro

echo.
echo --------------------------------------------------
echo  PASSO 3 de 4: Guardar a sua chave e a sua senha
echo  Vou pedir DUAS coisas, uma de cada vez:
echo    1) cole a sua chave da Anthropic e aperte ENTER
echo    2) digite a senha que voce quer pro site e aperte ENTER
echo --------------------------------------------------
echo.
echo  -- Agora cole a sua CHAVE DA ANTHROPIC e aperte ENTER:
call vercel env add ANTHROPIC_API_KEY production
echo.
echo  -- Agora digite a SENHA que voce quer pro site e aperte ENTER:
call vercel env add APP_PASSWORD production

echo.
echo --------------------------------------------------
echo  PASSO 4 de 4: Publicar a versao final
echo --------------------------------------------------
call vercel --prod
if errorlevel 1 goto erro

echo.
echo ==================================================
echo   PRONTO!
echo   O link do seu site aparece logo acima,
echo   termina com  .vercel.app
echo   Abra no celular e salve nos favoritos.
echo ==================================================
echo.
pause
exit /b 0

:erro
echo.
echo ==================================================
echo   Alguma coisa deu errado no passo acima.
echo   Copie a mensagem que apareceu e mande pro Claude
echo   que ele te ajuda a resolver.
echo ==================================================
echo.
pause
exit /b 1
