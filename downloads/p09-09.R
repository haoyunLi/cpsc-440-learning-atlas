C <- rbind(c(1,1,-1,-1),c(1,-1,1,-1),c(1,-1,-1,1))
print(rowSums(C))
print(tcrossprod(C))
stopifnot(all(rowSums(C)==0),all(tcrossprod(C)==4*diag(3)))
