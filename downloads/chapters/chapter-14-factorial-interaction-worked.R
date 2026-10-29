# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 14, section: factorial-interaction-worked
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

d <- data.frame(
  A=factor(rep(c("A1","A2"),each=4)),
  B=factor(rep(c("B1","B1","B2","B2"),2)),
  y=c(9,11,11,13,13,15,19,21))
# The asterisk includes both main effects and their interaction.
fit <- aov(y ~ A*B,data=d)
summary(fit)
with(d,interaction.plot(B,A,y,ylab="Mean response"))
