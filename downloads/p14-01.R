means <- matrix(c(10,14,12,22),nrow=2,
                dimnames=list(c("A","B"),c("Low","High")))
simple <- means["B",]-means["A",]
answer <- simple["High"]-simple["Low"]
print(c(simple,interaction=unname(answer)))
